# ICRC Ledger Standards

ICRC-1 is the fungible token standard on Internet Computer, defining transfer, balance, and metadata interfaces. ICRC-2 extends it with approve/transferFrom (allowance) mechanics, enabling third-party spending like ERC-20 on Ethereum.

## Canister IDs

| Token | Ledger Canister ID | Fee | Decimals |
|-------|-------------------|-----|----------|
| ICP | `ryjl3-tyaaa-aaaaa-aaaba-cai` | 10000 e8s (0.0001 ICP) | 8 |
| ckBTC | `mxzaz-hqaaa-aaaar-qaada-cai` | 10 satoshis | 8 |
| ckETH | `ss2fx-dyaaa-aaaar-qacoq-cai` | 2000000000000 wei (0.000002 ETH) | 18 |

Index canisters (for transaction history):
- ICP Index: `qhbym-qaaaa-aaaaa-aaafq-cai`
- ckBTC Index: `n5wcd-faaaa-aaaar-qaaea-cai`
- ckETH Index: `s3zol-vqaaa-aaaar-qacpa-cai`

## Mistakes That Break Your Build

1. **Wrong fee amount** -- ICP fee is 10000 e8s, NOT 10000 ICP. ckBTC fee is 10 satoshis, NOT 10 ckBTC. Using the wrong unit drains your entire balance in one transfer.

2. **Forgetting approve before transferFrom** -- ICRC-2 transferFrom will reject with `InsufficientAllowance` if the token owner has not called `icrc2_approve` first. This is a two-step flow: owner approves, then spender calls transferFrom.

3. **Not handling Err variants** -- `icrc1_transfer` returns `Result<Nat, TransferError>`, not just `Nat`. The error variants are: `BadFee`, `BadBurn`, `InsufficientFunds`, `TooOld`, `CreatedInFuture`, `Duplicate`, `TemporarilyUnavailable`, `GenericError`. You must match on every variant or at minimum propagate the error.

4. **Using wrong Account format** -- An ICRC-1 Account is `{ owner: Principal; subaccount: ?Blob }`, NOT just a Principal. The subaccount is a 32-byte blob. Passing null/None for subaccount uses the default subaccount (all zeros).

5. **Omitting created_at_time** -- Without `created_at_time`, you lose deduplication protection. Two identical transfers submitted within 24h will both execute. Set `created_at_time` to `Time.now()` (Motoko) or `ic_cdk::api::time()` (Rust) for dedup.

6. **Hardcoding canister IDs as text** -- Always use `Principal.fromText("ryjl3-tyaaa-aaaaa-aaaba-cai")` (Motoko) or `Principal::from_text("ryjl3-tyaaa-aaaaa-aaaba-cai")` (Rust). Never pass raw strings where a Principal is expected.

7. **Calling ledger from frontend** -- ICRC-1 transfers should originate from a backend canister, not directly from the frontend. Frontend-initiated transfers expose the user to reentrancy and can bypass business logic. Use a backend canister as the intermediary.

8. **Shell substitution in `--argument-file` / `init_arg_file`** -- Expressions like `$(icp identity principal)` do NOT expand inside files referenced by `init_arg_file` or `--argument-file`. The file is read as literal text. Either use `--argument` on the command line (where the shell expands variables), or pre-generate the file with `envsubst` / `sed` before deploying.

## Key Patterns

### Motoko

```motoko
import Principal "mo:core/Principal";
import Nat "mo:core/Nat";
import Nat64 "mo:core/Nat64";
import Time "mo:core/Time";
import Int "mo:core/Int";
import Runtime "mo:core/Runtime";

persistent actor {

  type Account = { owner : Principal; subaccount : ?Blob };

  type TransferArg = {
    from_subaccount : ?Blob; to : Account; amount : Nat;
    fee : ?Nat; memo : ?Blob; created_at_time : ?Nat64;
  };

  type TransferError = {
    #BadFee : { expected_fee : Nat }; #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat }; #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat }; #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  // Swap canister ID for other tokens (ckBTC: mxzaz-..., ckETH: ss2fx-...)
  transient let icpLedger = actor ("ryjl3-tyaaa-aaaaa-aaaba-cai") : actor {
    icrc1_balance_of : shared query (Account) -> async Nat;
    icrc1_transfer : shared (TransferArg) -> async { #Ok : Nat; #Err : TransferError };
    icrc1_fee : shared query () -> async Nat;
  };

  public func getBalance(who : Principal) : async Nat {
    await icpLedger.icrc1_balance_of({ owner = who; subaccount = null })
  };

  public func sendTokens(to : Principal, amount : Nat) : async Nat {
    let now = Nat64.fromNat(Int.abs(Time.now()));
    let result = await icpLedger.icrc1_transfer({
      from_subaccount = null;
      to = { owner = to; subaccount = null };
      amount = amount;
      fee = ?10000; // ICP fee: 10000 e8s
      memo = null;
      created_at_time = ?now;
    });
    switch (result) {
      case (#Ok(blockIndex)) { blockIndex };
      case (#Err(#InsufficientFunds({ balance }))) {
        Runtime.trap("Insufficient funds. Balance: " # Nat.toText(balance))
      };
      case (#Err(#BadFee({ expected_fee }))) {
        Runtime.trap("Wrong fee. Expected: " # Nat.toText(expected_fee))
      };
      case (#Err(_)) { Runtime.trap("Transfer failed") };
    }
  };
}
```

### Rust

```rust
use candid::{Nat, Principal};
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};
use ic_cdk::update;
use ic_cdk::call::Call;

const ICP_LEDGER: &str = "ryjl3-tyaaa-aaaaa-aaaba-cai";
const ICP_FEE: u64 = 10_000; // 10000 e8s

fn ledger_id() -> Principal { Principal::from_text(ICP_LEDGER).unwrap() }

#[update]
async fn get_balance(who: Principal) -> Nat {
    let account = Account { owner: who, subaccount: None };
    let (balance,): (Nat,) = Call::unbounded_wait(ledger_id(), "icrc1_balance_of")
        .with_arg(account).await.expect("Failed to call icrc1_balance_of")
        .candid_tuple().expect("Failed to decode response");
    balance
}

#[update]
async fn send_tokens(to: Principal, amount: Nat) -> Result<Nat, String> {
    let transfer_arg = TransferArg {
        from_subaccount: None,
        to: Account { owner: to, subaccount: None },
        amount,
        fee: Some(Nat::from(ICP_FEE)),
        memo: None,
        created_at_time: Some(ic_cdk::api::time()),
    };
    let (result,): (Result<Nat, TransferError>,) =
        Call::unbounded_wait(ledger_id(), "icrc1_transfer")
            .with_arg(transfer_arg).await
            .map_err(|e| format!("Call failed: {:?}", e))?
            .candid_tuple()
            .map_err(|e| format!("Decode failed: {:?}", e))?;
    match result {
        Ok(block_index) => Ok(block_index),
        Err(TransferError::InsufficientFunds { balance }) =>
            Err(format!("Insufficient funds. Balance: {}", balance)),
        Err(TransferError::BadFee { expected_fee }) =>
            Err(format!("Wrong fee. Expected: {}", expected_fee)),
        Err(e) => Err(format!("Transfer error: {:?}", e)),
    }
}
```
