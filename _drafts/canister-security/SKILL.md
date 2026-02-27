---
name: canister-security
description: "Secures IC canisters against IC-specific attack patterns. Covers access control, caller validation, cycle drain protection, async state vulnerabilities, and controller safety. Use when implementing any canister that handles user data, tokens, or access control. Do NOT use for canister-level programming patterns or deployment workflows."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.0"
metadata:
  title: Canister Security
  category: Security
  version: 1.0.0
  status: stable
  dependencies: ""
---

# Canister Security

## What This Is

IC canisters face security challenges that don't exist in traditional web development. The async messaging model creates TOCTOU (time-of-check-time-of-use) vulnerabilities, `canister_inspect_message` is NOT a reliable security boundary, and anyone on the internet can burn your cycles by sending update calls. This skill covers the IC-specific patterns that prevent exploitable canisters.

## Prerequisites

- `icp-cli` >= 0.2.0 — see [icp-cli](../icp-cli/SKILL.md) for setup
- For Motoko: `mops` package manager, `core = "2.0.0"` in mops.toml
- For Rust: `ic-cdk = "0.19"`, `candid = "0.10"`

## Mistakes That Break Your Build

1. **Relying on `canister_inspect_message` for access control.** This hook runs on a SINGLE replica node and can be bypassed by a malicious node. It is NEVER called for inter-canister calls. Always duplicate access checks inside every update method. Use `inspect_message` only as a cycle-saving optimization, never as a security boundary.

2. **Forgetting to reject the anonymous principal.** Every endpoint that requires authentication must check `caller != Principal.anonymous()`. Without this, unauthenticated requests silently succeed. This is the most common IC security bug.

3. **Reading state before an async call and assuming it's unchanged after.** When your canister `await`s an inter-canister call, other messages can interleave and mutate state. This TOCTOU pattern is the #1 source of DeFi exploits on IC. For detailed async atomicity patterns and saga-based compensation, see [inter-canister-calls](../inter-canister-calls/SKILL.md).

4. **Not setting a freezing threshold.** Without it, a canister silently runs out of cycles and gets deleted — all state lost permanently. Set `freezing_threshold` to at least 30 days (2,592,000 seconds):
   ```bash
   icp canister settings update backend --freezing-threshold 2592000 -e ic
   ```
   Verify with `icp canister settings show backend -e ic` (see [icp-cli](../icp-cli/SKILL.md) for CLI details).

5. **Single controller with no backup.** If you lose the controller identity's PEM file, the canister becomes unupgradeable forever. Always add a backup controller or governance canister:
   ```bash
   icp canister settings update backend --add-controller <backup-principal> -e ic
   ```

6. **Hardcoding or fetching the root key incorrectly.** Any agent (frontend, script, test harness) connecting to the IC must use the correct root key to verify response signatures. For frontends served by asset canisters, the root key is provided automatically via the `ic_env` cookie (since SDK v0.32.0); use `getCanisterEnv()` from `@icp-sdk/core/agent/canister-env` to read it. For dev servers or non-frontend agents (scripts, test harnesses), obtain the root key from `icp network status --json` (field `root_key`) and pass it to the agent. Never call the deprecated `fetchRootKey()` — it trusts whatever key the endpoint returns, including an attacker's.

7. **Exposing admin methods without guards.** Every update method is callable by anyone on the internet. Admin methods (migration, config, minting) must explicitly check the caller against an allowlist.

8. **Storing secrets in canister state.** Canister memory on standard application subnets is readable by node operators. Never store private keys, API secrets, or passwords. For on-chain secret management, use vetKD (see [vetkd-encryption](../vetkd-encryption/SKILL.md) when available).

## How It Works

### IC Security Model

1. **Update calls** go through consensus — all nodes on a subnet (typically 13, up to 34+ for fiduciary subnets) execute the code and must agree on the result. This makes them tamper-proof but slow (~2s).
2. **Query calls** run on a single node — fast (~200ms) but the node can return fabricated results. Never trust query results for security-critical decisions unless they include certified data.
3. **Inter-canister calls** are async messages. Between sending a request and receiving the response, your canister can process other messages. State may change under you.
4. **`canister_inspect_message`** runs BEFORE Candid decoding on a single node. It reduces cycle waste from spam but is not a security check.

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
    admins := Array.append(admins, [newAdmin]);
  };
};
```

#### Async safety — capture caller before await

```motoko
public shared ({ caller }) func transfer(to : Principal, amount : Nat) : async () {
  // CAPTURE caller and validate BEFORE any await
  let sender = caller;
  requireAuthenticated(sender);

  // Validate balance (read state before await)
  let balance = getBalance(sender);
  if (balance < amount) { Runtime.trap("insufficient balance") };

  // DEDUCT FIRST, then make the external call
  // If the external call fails, re-credit
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

#### inspect_message — cycle drain reduction (NOT a security boundary)

Motoko supports message inspection via `system func inspect`. Like Rust's `#[inspect_message]`, this runs on a single node and is NOT a security check — always duplicate real access control inside each method.

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
use ic_cdk::{caller, init, update};
use candid::Principal;
use std::cell::RefCell;

thread_local! {
    static OWNER: RefCell<Principal> = RefCell::new(Principal::anonymous());
    static ADMINS: RefCell<Vec<Principal>> = RefCell::new(vec![]);
}

// --- Guards ---

fn require_authenticated() -> Principal {
    let caller = caller();
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

#### inspect_message — cycle drain reduction (NOT a security boundary)

```rust
use ic_cdk::api::{accept_message, msg_method_name};

/// Pre-filter to reduce cycle waste from spam.
/// Runs on ONE node. Can be bypassed. NOT a security check.
/// Always duplicate real access control inside each method.
#[ic_cdk::inspect_message]
fn inspect_message() {
    let method = msg_method_name();
    match method.as_str() {
        // Admin methods: only accept from non-anonymous callers
        "admin_action" | "add_admin" => {
            if caller() != Principal::anonymous() {
                accept_message();
            }
            // Silently reject anonymous — saves cycles on Candid decoding
        }
        // Public methods: accept all
        _ => accept_message(),
    }
}
```

#### Async safety — capture caller before .await

```rust
#[update]
async fn transfer(to: Principal, amount: u64) {
    // CAPTURE caller and validate BEFORE any .await
    let sender = require_authenticated();

    // Validate and deduct BEFORE the async call
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

## Deploy & Test

### Local Development

```bash
icp network start -d
icp deploy backend
```

### Test Access Control

```bash
# 1. Authenticated call should succeed (default identity is owner)
icp canister call backend public_action '()'
# Expected: ("ok")

# 2. Anonymous call should fail
# Use a separate identity or test with the anonymous principal
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

Run these checks after every mainnet deployment (see [icp-cli](../icp-cli/SKILL.md) for CLI details):

```bash
# 1. Verify controllers include a backup
icp canister settings show backend -e ic | grep Controllers
# Expected: at least 2 principals (your identity + backup)

# 2. Verify freezing threshold is set
icp canister settings show backend -e ic | grep "Freezing threshold"
# Expected: >= 2_592_000 seconds (30 days)

# 3. Verify cycles balance is healthy
icp canister settings show backend -e ic | grep "Balance"
# Expected: well above freezing threshold reserve
```

## Verify It Works

```bash
# 1. Anonymous rejection works
icp canister call backend public_action '()' --identity anonymous
# Expected: Error — "anonymous caller not allowed"

# 2. Authenticated call succeeds
icp canister call backend public_action '()'
# Expected: ("ok")

# 3. Admin-only method rejects non-admin
icp identity new test-user
icp canister call backend admin_action '()' --identity test-user
# Expected: Error — "caller is not an admin"

# 4. Owner can add admin
icp canister call backend add_admin '(principal "aaaaa-aa")'
# Expected: ()

# 5. Freezing threshold is configured (mainnet)
icp canister settings show backend -e ic
# Expected: Freezing threshold >= 2_592_000
```
