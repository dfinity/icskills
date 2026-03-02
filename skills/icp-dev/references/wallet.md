# Cycles & Canister Management

Cycles are the computation fuel for canisters on Internet Computer. Every canister operation (execution, storage, messaging) burns cycles. When a canister runs out of cycles, it freezes and eventually gets deleted. 1 trillion cycles (1T) costs approximately 1 USD equivalent in ICP. icp-cli uses the **cycles ledger** (`um5iw-rqaaa-aaaaq-qaaba-cai`) by default for cycle balance tracking.

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

## Key Patterns

### Motoko

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
    Cycles.accept<system>(available)
  };

  // Send cycles to another canister via inter-canister call
  public func topUpCanister(target : Principal) : async () {
    let targetActor = actor (Principal.toText(target)) : actor {
      deposit_cycles : shared () -> async ();
    };
    await (with cycles = 1_000_000_000_000) targetActor.deposit_cycles();
  };
}
```

### Rust

```rust
use ic_cdk::{query, update};
use candid::{Nat, Principal};
use ic_cdk::management_canister::{
    create_canister_with_extra_cycles, deposit_cycles,
    CreateCanisterArgs, DepositCyclesArgs, CanisterSettings,
};

#[query]
fn get_balance() -> Nat {
    Nat::from(ic_cdk::api::canister_cycle_balance())
}

#[update]
fn deposit() -> Nat {
    let available = ic_cdk::api::msg_cycles_available();
    if available == 0 {
        ic_cdk::trap("No cycles sent with this call");
    }
    Nat::from(ic_cdk::api::msg_cycles_accept(available))
}

#[update]
async fn create_new_canister() -> Principal {
    let caller = ic_cdk::api::canister_self();
    let user = ic_cdk::api::msg_caller();
    let settings = CanisterSettings {
        controllers: Some(vec![caller, user]),
        compute_allocation: None, memory_allocation: None,
        freezing_threshold: Some(Nat::from(2_592_000u64)), // 30 days
        reserved_cycles_limit: None, log_visibility: None,
        wasm_memory_limit: None, wasm_memory_threshold: None,
        environment_variables: None,
    };
    let arg = CreateCanisterArgs { settings: Some(settings) };
    let result = create_canister_with_extra_cycles(&arg, 1_000_000_000_000u128)
        .await.expect("Failed to create canister");
    result.canister_id
}

#[update]
async fn top_up(canister_id: Principal, amount: u128) {
    deposit_cycles(&DepositCyclesArgs { canister_id }, amount)
        .await.expect("Failed to deposit cycles");
}
```
