---
name: canister-security
description: "Secures IC canisters against IC-specific attack patterns. Covers access control, caller validation, cycles management, async state vulnerabilities (TOCTOU/reentrancy), controller safety, upgrade traps, and storage exhaustion. Use when implementing any canister that handles user data, tokens, or access control. Do NOT use for general canister programming patterns or deployment workflows."
license: Apache-2.0
metadata:
  title: Canister Security
  category: Security
---

# Canister Security

## What This Is

IC canisters face security challenges that don't exist in traditional web development. The async messaging model creates TOCTOU (time-of-check-time-of-use) vulnerabilities, `canister_inspect_message` is NOT a reliable security boundary, and anyone on the internet can burn your cycles by sending update calls. This skill covers the IC-specific patterns that prevent exploitable canisters.

## Prerequisites

- For Motoko: `mops` package manager, `core = "2.0.0"` in mops.toml
- For Rust: `ic-cdk = "0.19"`, `candid = "0.10"`

## Security Pitfalls

1. **Relying on `canister_inspect_message` for access control.** This hook runs on a single replica without full consensus. A malicious boundary node can bypass it by forwarding the message anyway. It is also never called for inter-canister calls, query calls, or management canister calls. Always duplicate access checks inside every update method. Use `inspect_message` only as a cycle-saving optimization, never as a security boundary. See [security best practices: ingress message inspection](https://docs.internetcomputer.org/building-apps/security/iam#do-not-rely-on-ingress-message-inspection).

2. **Forgetting to reject the anonymous principal.** Every endpoint that requires authentication must check that the caller is not the anonymous principal (`2vxsx-fae`). In Motoko use `Principal.isAnonymous(caller)`, in Rust compare `msg_caller() != Principal::anonymous()`. Without this, unauthenticated callers can invoke protected methods — and if the canister uses the caller principal as an identity key (e.g., for balances), the anonymous principal becomes a shared identity anyone can use.

3. **Reading state before an async call and assuming it's unchanged after (TOCTOU).** When your canister `await`s an inter-canister call, other messages can interleave and mutate state. This is one of the most critical sources of DeFi exploits on IC. Always deduct/lock state before the `await`, then compensate on failure (saga pattern). Consider per-caller or per-resource locks to prevent duplicate concurrent operations. See [security best practices: inter-canister calls](https://docs.internetcomputer.org/building-apps/security/inter-canister-calls).

4. **Trapping in `pre_upgrade`.** If `pre_upgrade` traps (e.g., serializing too much data exceeds the instruction limit), the canister becomes permanently non-upgradeable. This is arguably the most devastating IC-specific vulnerability. Avoid storing large data structures in the heap that must be serialized during upgrade. In Rust, use `ic-stable-structures` for direct stable memory access. In Motoko, use the `stable` keyword for persistent variables which are handled automatically.

5. **Not monitoring cycles balance.** Every canister has a default `freezing_threshold` of 2,592,000 seconds (~30 days). When cycles drop below the threshold reserve, the canister freezes (rejects all update calls). When cycles reach zero, the canister is uninstalled — its code and memory are removed, though the canister ID and controllers survive. The real pitfall is not actively monitoring and topping up cycles. For production canisters holding valuable state, increase the freezing threshold and set up automated monitoring.
   ```bash
   # Check current settings (mainnet)
   icp canister settings show backend -e ic
   # Increase freezing threshold for high-value canisters
   icp canister settings update backend --freezing-threshold 7776000 -e ic  # 90 days
   ```

6. **Single controller with no backup.** If you lose the controller identity's private key, the canister becomes unupgradeable forever. There is no recovery mechanism. Always add a backup controller or governance canister:
   ```bash
   icp canister settings update backend --add-controller <backup-principal> -e ic
   ```
   For high-value canisters, consider making an SNS or the canister itself a controller so governance can manage upgrades.

7. **Calling `fetchRootKey()` in production.** `fetchRootKey()` fetches the root public key from the replica and trusts whatever it returns. On mainnet, the root key is hardcoded into the agent — calling `fetchRootKey()` there allows a man-in-the-middle to substitute a different key, breaking all verification. Only call `fetchRootKey()` in local development, guarded by an environment check. For frontends served by asset canisters, the root key is provided automatically.

8. **Exposing admin methods without guards.** Every update method is callable by anyone on the internet. Admin methods (migration, config, minting) must explicitly check the caller against an allowlist. There is no built-in role system — you must implement it yourself.

9. **Storing secrets in canister state.** Canister memory on standard application subnets is readable by node operators. Never store private keys, API secrets, or passwords in canister state. For on-chain secret management, use vetKD (threshold key derivation).

10. **Allowing unbounded user-controlled storage.** If users can store data without limits, an attacker can fill the 4 GiB Wasm heap or stable memory, bricking the canister. Always enforce per-user storage quotas and validate input sizes.

11. **Trapping in a callback after state mutation.** If your canister mutates state, then makes an inter-canister call, and the callback traps, the state mutations from before the call persist but the callback's mutations are rolled back. A malicious callee can exploit this to skip security-critical actions like debiting an account. Structure code so that critical state mutations happen either entirely before or entirely after the async boundary. Consider using `call_on_cleanup` for rollback logic and journaling for crash-safe state transitions. See [security best practices: callback traps](https://docs.internetcomputer.org/building-apps/security/inter-canister-calls#securely-handle-traps-in-callbacks).

12. **Unbounded wait calls preventing upgrades.** If your canister makes a call to an untrustworthy or buggy callee that never responds, the canister cannot be stopped (and therefore cannot be upgraded) while awaiting outstanding responses. Use bounded wait calls (timeouts) to ensure calls complete in bounded time regardless of callee behavior. See [security best practices: untrustworthy canisters](https://docs.internetcomputer.org/building-apps/security/inter-canister-calls#be-aware-of-the-risks-involved-in-calling-untrustworthy-canisters).

## How It Works

### IC Security Model

1. **Update calls** go through consensus — all nodes on a subnet execute the code and must agree on the result. Standard application subnets have 13 nodes; system and fiduciary subnets have more (28+). This makes update calls tamper-proof but slower (~2s).
2. **Query calls** run on a single replica — fast (~200ms) but the replica can return incorrect results. Replica-signed queries provide partial mitigation (the responding replica signs the response), but for full trust, use certified data or update calls for security-critical reads.
3. **Inter-canister calls** are async messages. Between sending a request and receiving the response, your canister can process other messages. State may change under you (see TOCTOU pitfall above).
4. **`canister_inspect_message`** runs before Candid decoding on a single node. It reduces cycle waste from spam but is not a security check — a malicious boundary node can bypass it.

## Implementation

### Motoko

#### Access control pattern

```motoko
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

persistent actor {

  // --- Authorization state ---
  stable var owner : Principal = Principal.fromText("aaaaa-aa"); // replaced during init
  stable var admins : [Principal] = [];

  // --- Guards ---

  func requireAuthenticated(caller : Principal) {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("anonymous caller not allowed");
    };
  };

  func requireOwner(caller : Principal) {
    requireAuthenticated(caller);
    if (caller != owner) {
      Runtime.trap("caller is not the owner");
    };
  };

  func requireAdmin(caller : Principal) {
    requireAuthenticated(caller);
    let isAdmin = Array.find<Principal>(
      admins,
      func(a : Principal) : Bool { a == caller },
    );
    if (isAdmin == null and caller != owner) {
      Runtime.trap("caller is not an admin");
    };
  };

  // --- Public endpoints ---

  /// Anyone authenticated can call this
  public shared ({ caller }) func publicAction() : async Text {
    requireAuthenticated(caller);
    "ok";
  };

  /// Only admins / owner
  public shared ({ caller }) func adminAction() : async () {
    requireAdmin(caller);
    // ... protected logic
  };

  /// Only the owner
  public shared ({ caller }) func addAdmin(newAdmin : Principal) : async () {
    requireOwner(caller);
    admins := Array.concat(admins, [newAdmin]);
  };
};
```

#### Async safety (saga pattern)

```motoko
// Requires additional import: import Error "mo:core/Error"

public shared ({ caller }) func transfer(to : Principal, amount : Nat) : async () {
  // CAPTURE caller and validate BEFORE any await
  let sender = caller;
  requireAuthenticated(sender);

  // Validate and DEDUCT FIRST, then make the external call
  let balance = getBalance(sender);
  if (balance < amount) { Runtime.trap("insufficient balance") };
  deductBalance(sender, amount);

  try {
    await otherCanister.deposit(to, amount);
  } catch (e) {
    // Compensate: re-credit on failure
    creditBalance(sender, amount);
    Runtime.trap("transfer failed: " # Error.message(e));
  };
};
```

#### inspect_message (cycle drain reduction only)

```motoko
// Inside persistent actor { ... }

system func inspect(
  {
    caller : Principal;
    msg : {
      #adminAction : () -> ();
      #addAdmin : () -> Principal;
      #publicAction : () -> ();
    }
  }
) : Bool {
  switch (msg) {
    // Admin methods: reject anonymous to save cycles on Candid decoding
    case (#adminAction _) { not Principal.isAnonymous(caller) };
    case (#addAdmin _) { not Principal.isAnonymous(caller) };
    // Public methods: accept all
    case (_) { true };
  };
};
```

### Rust

#### Access control pattern

```rust
use ic_cdk::{init, update};
use ic_cdk::api::msg_caller;
use candid::Principal;
use std::cell::RefCell;

thread_local! {
    static OWNER: RefCell<Principal> = RefCell::new(Principal::anonymous());
    static ADMINS: RefCell<Vec<Principal>> = RefCell::new(vec![]);
}

// --- Guards ---

fn require_authenticated() -> Principal {
    let caller = msg_caller();
    assert_ne!(caller, Principal::anonymous(), "anonymous caller not allowed");
    caller
}

fn require_owner() -> Principal {
    let caller = require_authenticated();
    OWNER.with(|o| {
        assert_eq!(caller, *o.borrow(), "caller is not the owner");
    });
    caller
}

fn require_admin() -> Principal {
    let caller = require_authenticated();
    let is_authorized = OWNER.with(|o| caller == *o.borrow())
        || ADMINS.with(|a| a.borrow().contains(&caller));
    assert!(is_authorized, "caller is not an admin");
    caller
}

// --- Init ---

#[init]
fn init(owner: Principal) {
    OWNER.with(|o| *o.borrow_mut() = owner);
}

// --- Endpoints ---

#[update]
fn public_action() -> String {
    require_authenticated();
    "ok".to_string()
}

#[update]
fn admin_action() {
    require_admin();
    // ... protected logic
}

#[update]
fn add_admin(new_admin: Principal) {
    require_owner();
    ADMINS.with(|a| a.borrow_mut().push(new_admin));
}

ic_cdk::export_candid!();
```

#### inspect_message (cycle drain reduction only)

```rust
use ic_cdk::api::{accept_message, msg_caller, msg_method_name};
use candid::Principal;

/// Pre-filter to reduce cycle waste from spam.
/// Runs on ONE node. Can be bypassed. NOT a security check.
/// Always duplicate real access control inside each method.
#[ic_cdk::inspect_message]
fn inspect_message() {
    let method = msg_method_name();
    match method.as_str() {
        // Admin methods: only accept from non-anonymous callers
        "admin_action" | "add_admin" => {
            if msg_caller() != Principal::anonymous() {
                accept_message();
            }
            // Silently reject anonymous — saves cycles on Candid decoding
        }
        // Public methods: accept all
        _ => accept_message(),
    }
}
```

#### Async safety (saga pattern)

```rust
#[update]
async fn transfer(to: Principal, amount: u64) {
    // CAPTURE caller and validate BEFORE any .await
    let sender = require_authenticated();

    // Validate and DEDUCT FIRST, then make the async call
    let balance = get_balance(&sender);
    assert!(balance >= amount, "insufficient balance");
    deduct_balance(&sender, amount);

    // Make inter-canister call
    match other_canister_deposit(to, amount).await {
        Ok(()) => { /* success */ }
        Err(err) => {
            // Compensate: re-credit on failure
            credit_balance(&sender, amount);
            ic_cdk::trap(&format!("transfer failed: {:?}", err));
        }
    }
}
```

## Verify It Works

### Access Control

```bash
# 1. Authenticated call should succeed
icp canister call backend public_action '()'
# Expected: ("ok")

# 2. Anonymous call should fail
icp canister call backend public_action '()' --identity anonymous
# Expected: Error containing "anonymous caller not allowed"

# 3. Admin call from owner should succeed
icp canister call backend admin_action '()'
# Expected: ()

# 4. Admin call from non-admin should fail
icp identity new attacker
icp canister call backend admin_action '()' --identity attacker
# Expected: Error containing "caller is not an admin"
```

### Mainnet Security Checklist

```bash
# 1. Verify controllers include a backup
icp canister settings show backend -e ic
# Expected: at least 2 controllers (your identity + backup)

# 2. Verify freezing threshold is adequate
# Default: 2,592,000 seconds (30 days). Increase for high-value canisters.

# 3. Verify cycles balance is healthy — well above freezing threshold reserve
```
