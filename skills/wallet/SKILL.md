---
id: wallet
name: Cycles Wallet Management
category: Infrastructure
description: "Create, fund, and manage cycles wallets. Top-up canisters, check balances, and automate cycle management."
endpoints: 7
version: 1.4.0
status: stable
dependencies: []
---

# Cycles & Canister Management
> version: 1.0.0 | requires: [icp-cli >= 0.1.0]

## What This Is
Cycles are the computation fuel for canisters on Internet Computer. Every canister operation (execution, storage, messaging) burns cycles. When a canister runs out of cycles, it freezes and eventually gets deleted. 1 trillion cycles (1T) costs approximately 1 USD equivalent in ICP (the exact rate is set by the NNS and fluctuates with ICP price via the CMC).

**Note:** icp-cli uses the **cycles ledger** (`um5iw-rqaaa-aaaaq-qaaba-cai`) by default. The cycles ledger is a single canister that tracks cycle balances for all principals, similar to a token ledger. Commands like `icp cycles balance`, `icp cycles mint`, and `icp canister top-up` go through the cycles ledger. There is no legacy wallet concept in icp-cli. The programmatic patterns below (accepting cycles, creating canisters via management canister) remain the same regardless of which funding mechanism is used.

## Prerequisites
- icp-cli >= 0.1.0 (install: `brew install dfinity/tap/icp-cli`)
- An identity with ICP balance for converting to cycles (mainnet)
- For local development: cycles are unlimited by default

## Canister IDs

| Service | Canister ID | Purpose |
|---------|------------|---------|
| Cycles Minting Canister (CMC) | `rkp4c-7iaaa-aaaaa-aaaca-cai` | Converts ICP to cycles, creates canisters |
| NNS Ledger (ICP) | `ryjl3-tyaaa-aaaaa-aaaba-cai` | ICP token transfers |
| Management Canister | `aaaaa-aa` | Canister lifecycle (create, install, stop, delete, status) |

The Management Canister (`aaaaa-aa`) is a virtual canister -- it does not exist on a specific subnet but is handled by every subnet's execution layer.

## Mistakes That Break Your Build

1. **Running out of cycles silently freezes the canister** -- There is no warning. The canister stops responding to all calls. If cycles are not topped up before the freezing threshold, the canister and all its data will be permanently deleted. Set a freezing threshold and monitor balances.

2. **Not setting freezing_threshold** -- Default is 30 days. If your canister burns cycles fast (high traffic, large stable memory), 30 days may not be enough warning. Set it higher for production canisters. The freezing threshold defines how many seconds worth of idle cycles the canister must retain before it freezes.

3. **Confusing local vs mainnet cycles** -- Local replicas give canisters virtually unlimited cycles. Code that works locally may fail on mainnet because the canister has insufficient cycles. Always test with realistic cycle amounts before mainnet deployment.

4. **Sending cycles to the wrong canister** -- Cycles sent to a canister cannot be retrieved. There is no refund mechanism for cycles transferred to the wrong principal. Double-check the canister ID before topping up.

5. **Forgetting to set the canister controller** -- If you lose the controller identity, you permanently lose the ability to upgrade, top up, or manage the canister. Always add a backup controller. Use `icp canister update-settings --add-controller PRINCIPAL` to add one.

6. **Using ExperimentalCycles in mo:core** -- In mo:core 2.0, the module is renamed to `Cycles`. `import ExperimentalCycles "mo:base/ExperimentalCycles"` will fail. Use `import Cycles "mo:core/Cycles"`.

7. **Not accounting for the transfer fee when converting ICP to cycles** -- Converting ICP to cycles via the CMC requires an ICP transfer to the CMC first. That transfer costs 10000 e8s fee. If you send your exact ICP balance, the transfer will fail due to insufficient funds after the fee.

## Implementation

### Motoko

#### Checking and Accepting Cycles

```motoko
import Cycles "mo:core/Cycles";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {

  // Check this canister's cycle balance
  public query func getBalance() : async Nat {
    Cycles.balance()
  };

  // Accept cycles sent with a call (for "tip jar" or payment patterns)
  public func deposit() : async Nat {
    let available = Cycles.available();
    if (available == 0) {
      Runtime.trap("No cycles sent with this call")
    };
    let accepted = Cycles.accept<system>(available);
    accepted
  };

  // Send cycles to another canister via inter-canister call
  public func topUpCanister(target : Principal) : async () {
    let targetActor = actor (Principal.toText(target)) : actor {
      deposit_cycles : shared () -> async ();
    };
    // Attach 1T cycles to the call
    await (with cycles = 1_000_000_000_000) targetActor.deposit_cycles();
  };
}
```

#### Creating a Canister Programmatically

```motoko
import Cycles "mo:core/Cycles";
import Principal "mo:core/Principal";

persistent actor {

  type CanisterId = { canister_id : Principal };

  type CreateCanisterSettings = {
    controllers : ?[Principal];
    compute_allocation : ?Nat;
    memory_allocation : ?Nat;
    freezing_threshold : ?Nat;
  };

  // Management canister interface
  let ic = actor ("aaaaa-aa") : actor {
    create_canister : shared { settings : ?CreateCanisterSettings } ->
      async CanisterId;
    canister_status : shared { canister_id : Principal } ->
      async {
        status : { #running; #stopping; #stopped };
        memory_size : Nat;
        cycles : Nat;
        settings : CreateCanisterSettings;
        module_hash : ?Blob;
      };
    deposit_cycles : shared { canister_id : Principal } -> async ();
    stop_canister : shared { canister_id : Principal } -> async ();
    delete_canister : shared { canister_id : Principal } -> async ();
  };

  // Create a new canister with 1T cycles
  public func createNewCanister() : async Principal {
    let result = await (with cycles = 1_000_000_000_000) ic.create_canister({
      settings = ?{
        controllers = ?[Principal.fromActor(this)];
        compute_allocation = null;
        memory_allocation = null;
        freezing_threshold = ?2_592_000; // 30 days in seconds
      };
    });
    result.canister_id
  };

  // Check a canister's status and cycle balance
  public func checkStatus(canisterId : Principal) : async Nat {
    let status = await ic.canister_status({ canister_id = canisterId });
    status.cycles
  };

  // Top up another canister
  public func topUp(canisterId : Principal, amount : Nat) : async () {
    await (with cycles = amount) ic.deposit_cycles({ canister_id = canisterId });
  };
}
```

### Rust

#### Cargo.toml Dependencies

```toml
[dependencies]
ic-cdk = "0.18"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
```

#### Checking Balance and Accepting Cycles

```rust
use ic_cdk::{query, update};
use candid::Nat;

#[query]
fn get_balance() -> Nat {
    Nat::from(ic_cdk::canister_balance128())
}

#[update]
fn deposit() -> Nat {
    let available = ic_cdk::msg_cycles_available128();
    if available == 0 {
        ic_cdk::trap("No cycles sent with this call");
    }
    let accepted = ic_cdk::msg_cycles_accept128(available);
    Nat::from(accepted)
}
```

#### Creating and Managing Canisters

```rust
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::update;
use ic_cdk::management_canister::{
    create_canister, canister_status, deposit_cycles, stop_canister, delete_canister,
    CreateCanisterArgument, CanisterIdRecord,
    CanisterSettings, CanisterStatusResponse,
};

#[update]
async fn create_new_canister() -> Principal {
    let caller = ic_cdk::caller(); // capture before await

    let settings = CanisterSettings {
        controllers: Some(vec![ic_cdk::id(), caller]),
        compute_allocation: None,
        memory_allocation: None,
        freezing_threshold: Some(Nat::from(2_592_000u64)), // 30 days
        reserved_cycles_limit: None,
        log_visibility: None,
        wasm_memory_limit: None,
    };

    let arg = CreateCanisterArgument {
        settings: Some(settings),
    };

    // Send 1T cycles with the create call
    let (result,) = create_canister(arg, 1_000_000_000_000u128)
        .await
        .expect("Failed to create canister");

    result.canister_id
}

#[update]
async fn check_status(canister_id: Principal) -> CanisterStatusResponse {
    let (status,) = canister_status(CanisterIdRecord { canister_id })
        .await
        .expect("Failed to get canister status");
    status
}

#[update]
async fn top_up(canister_id: Principal, amount: u128) {
    deposit_cycles(CanisterIdRecord { canister_id }, amount)
        .await
        .expect("Failed to deposit cycles");
}

#[update]
async fn stop_and_delete(canister_id: Principal) {
    stop_canister(CanisterIdRecord { canister_id })
        .await
        .expect("Failed to stop canister");

    delete_canister(CanisterIdRecord { canister_id })
        .await
        .expect("Failed to delete canister");
}
```

## Deploy & Test

### Check Cycle Balance

```bash
# Check your canister's cycle balance
icp canister status backend
# Look for "Balance:" line in output

# Check balance on mainnet
icp canister status backend -e ic

# Check any canister by ID
icp canister status ryjl3-tyaaa-aaaaa-aaaba-cai -e ic
```

### Top Up a Canister

```bash
# Top up with cycles from the cycles ledger (local)
icp canister top-up backend --amount 1000000000000
# Adds 1T cycles to the backend canister

# Top up on mainnet
icp canister top-up backend --amount 1000000000000 -e ic

# Convert ICP to cycles and top up in one step (mainnet)
icp cycles mint --amount 1.0 -e ic
icp canister top-up backend --amount 1000000000000 -e ic
```

### Create a Canister via icp

```bash
# Create an empty canister (local)
icp canister create my_canister

# Create on mainnet with specific cycles
icp canister create my_canister -e ic --with-cycles 2000000000000

# Add a backup controller
icp canister update-settings my_canister --add-controller BACKUP_PRINCIPAL_HERE
```

### Set Freezing Threshold

```bash
# Set freezing threshold to 90 days (in seconds: 90 * 24 * 60 * 60 = 7776000)
icp canister update-settings backend --freezing-threshold 7776000

# Mainnet
icp canister update-settings backend --freezing-threshold 7776000 -e ic
```

## Verify It Works

```bash
# 1. Deploy a canister and check its status
icp network start -d
icp deploy backend
icp canister status backend
# Expected output includes:
#   Status: Running
#   Balance: 3_100_000_000_000 Cycles (local default, varies)
#   Freezing threshold: 2_592_000

# 2. Check balance programmatically (if you added getBalance)
icp canister call backend getBalance '()'
# Expected: a large nat value, e.g. (3_100_000_000_000 : nat)

# 3. Verify controllers
icp canister info backend
# Expected: Shows your principal as controller

# 4. On mainnet: verify cycles balance is not zero
icp canister status backend -e ic
# If Balance shows 0, the canister will freeze. Top up immediately.

# 5. Verify freezing threshold was set
icp canister status backend
# Look for "Freezing threshold:" -- should match what you set
```

### Monitoring Checklist for Production

```bash
# Run periodically for mainnet canisters:
CANISTER_ID="your-canister-id-here"

# Check balance
icp canister status $CANISTER_ID -e ic

# Warning thresholds:
# < 5T cycles   -- top up soon
# < 1T cycles   -- urgent, canister may freeze
# 0 cycles      -- canister is frozen, data at risk of deletion
```
