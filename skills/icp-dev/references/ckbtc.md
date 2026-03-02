# Chain-Key Bitcoin (ckBTC) Integration

ckBTC is a 1:1 BTC-backed token native to the Internet Computer. No bridges, no wrapping, no third-party custodians. The ckBTC minter canister holds real BTC and mints/burns ckBTC tokens. Transfers settle in 1-2 seconds with a 10 satoshi fee.

## Canister IDs

### Bitcoin Mainnet

| Canister | ID |
|---|---|
| ckBTC Ledger | `mxzaz-hqaaa-aaaar-qaada-cai` |
| ckBTC Minter | `mqygn-kiaaa-aaaar-qaadq-cai` |
| ckBTC Index | `n5wcd-faaaa-aaaar-qaaea-cai` |
| ckBTC Checker | `oltsj-fqaaa-aaaar-qal5q-cai` |

### Bitcoin Testnet4

| Canister | ID |
|---|---|
| ckBTC Ledger | `mc6ru-gyaaa-aaaar-qaaaq-cai` |
| ckBTC Minter | `ml52i-qqaaa-aaaar-qaaba-cai` |
| ckBTC Index | `mm444-5iaaa-aaaar-qaabq-cai` |

## Mistakes That Break Your Build

1. **Using the wrong minter canister ID.** The minter ID is `mqygn-kiaaa-aaaar-qaadq-cai`. Do not confuse it with the ledger (`mxzaz-...`) or index (`n5wcd-...`).

2. **Forgetting the 10 satoshi transfer fee.** Every `icrc1_transfer` deducts 10 satoshis beyond the amount. If the user has exactly 1000 satoshis and you transfer 1000, it fails with `InsufficientFunds`. Transfer `balance - 10` instead.

3. **Not calling `update_balance` after a BTC deposit.** Sending BTC to the deposit address does nothing until you call `update_balance`. The minter does not auto-detect deposits. Your app must call this.

4. **Using Account Identifier instead of ICRC-1 Account.** ckBTC uses the ICRC-1 standard: `{ owner: Principal, subaccount: ?Blob }`. Do NOT use the legacy `AccountIdentifier` (hex string) from the ICP ledger.

5. **Subaccount must be exactly 32 bytes or null.** Passing a subaccount shorter or longer than 32 bytes causes a trap. Pad with leading zeros if deriving from a shorter value.

6. **Calling `retrieve_btc` with amount below the minimum.** The minter has a minimum withdrawal amount (currently 50,000 satoshis / 0.0005 BTC). Below this, you get `AmountTooLow`.

7. **Not checking the `retrieve_btc` response for errors.** The response is a variant: `Ok` contains `{ block_index }`, `Err` contains specific errors like `MalformedAddress`, `InsufficientFunds`, `TemporarilyUnavailable`. Always match both arms.

8. **Forgetting `owner` in `get_btc_address` args.** If you omit `owner`, Candid sub-typing assigns null, and the minter returns the deposit address of the caller (the canister) instead of the user.

## Key Patterns

### Motoko

```motoko
import Principal "mo:core/Principal";
import Blob "mo:core/Blob";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Nat64 "mo:core/Nat64";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

persistent actor Self {

  type Account = { owner : Principal; subaccount : ?Blob };

  type TransferArgs = {
    from_subaccount : ?Blob; to : Account; amount : Nat;
    fee : ?Nat; memo : ?Blob; created_at_time : ?Nat64;
  };

  type TransferResult = { #Ok : Nat; #Err : TransferError };
  type TransferError = {
    #BadFee : { expected_fee : Nat }; #BadBurn : { min_burn_amount : Nat };
    #InsufficientFunds : { balance : Nat }; #TooOld;
    #CreatedInFuture : { ledger_time : Nat64 };
    #Duplicate : { duplicate_of : Nat }; #TemporarilyUnavailable;
    #GenericError : { error_code : Nat; message : Text };
  };

  type UpdateBalanceResult = { #Ok : [UtxoStatus]; #Err : UpdateBalanceError };
  type UtxoStatus = {
    #ValueTooSmall : Utxo; #Tainted : Utxo; #Checked : Utxo;
    #Minted : { block_index : Nat64; minted_amount : Nat64; utxo : Utxo };
  };
  type Utxo = { outpoint : { txid : Blob; vout : Nat32 }; value : Nat64; height : Nat32 };
  type UpdateBalanceError = {
    #NoNewUtxos : { required_confirmations : Nat32; pending_utxos : ?[PendingUtxo]; current_confirmations : ?Nat32 };
    #AlreadyProcessing; #TemporarilyUnavailable : Text;
    #GenericError : { error_code : Nat64; error_message : Text };
  };
  type PendingUtxo = { outpoint : { txid : Blob; vout : Nat32 }; value : Nat64; confirmations : Nat32 };

  transient let ckbtcLedger : actor {
    icrc1_transfer : shared (TransferArgs) -> async TransferResult;
    icrc1_balance_of : shared query (Account) -> async Nat;
  } = actor "mxzaz-hqaaa-aaaar-qaada-cai";

  transient let ckbtcMinter : actor {
    get_btc_address : shared ({ owner : ?Principal; subaccount : ?Blob }) -> async Text;
    update_balance : shared ({ owner : ?Principal; subaccount : ?Blob }) -> async UpdateBalanceResult;
  } = actor "mqygn-kiaaa-aaaar-qaadq-cai";

  // Derive a 32-byte subaccount from a principal for per-user deposit addresses.
  func principalToSubaccount(p : Principal) : Blob {
    let bytes = Blob.toArray(Principal.toBlob(p));
    let size = bytes.size();
    let sub = Array.tabulate<Nat8>(32, func(i : Nat) : Nat8 {
      if (i == 0) { Nat8.fromNat(size) }
      else if (i <= size) { bytes[i - 1] }
      else { 0 }
    });
    Blob.fromArray(sub)
  };

  // Get user's BTC deposit address
  public shared ({ caller }) func getDepositAddress() : async Text {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Authentication required") };
    let subaccount = principalToSubaccount(caller);
    await ckbtcMinter.get_btc_address({
      owner = ?Principal.fromActor(Self);
      subaccount = ?subaccount;
    })
  };

  // Check for new BTC deposits and mint ckBTC
  public shared ({ caller }) func updateBalance() : async UpdateBalanceResult {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Authentication required") };
    let subaccount = principalToSubaccount(caller);
    await ckbtcMinter.update_balance({
      owner = ?Principal.fromActor(Self);
      subaccount = ?subaccount;
    })
  };

  // Transfer ckBTC
  public shared ({ caller }) func transfer(to : Principal, amount : Nat) : async TransferResult {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Authentication required") };
    let fromSubaccount = principalToSubaccount(caller);
    await ckbtcLedger.icrc1_transfer({
      from_subaccount = ?fromSubaccount;
      to = { owner = to; subaccount = null };
      amount = amount;
      fee = ?10; // 10 satoshis
      memo = null;
      created_at_time = null;
    })
  };
};
```

### Rust

```rust
use candid::{CandidType, Deserialize, Nat, Principal};
use ic_cdk::update;
use ic_cdk::call::Call;
use icrc_ledger_types::icrc1::account::Account;
use icrc_ledger_types::icrc1::transfer::{TransferArg, TransferError};

const CKBTC_LEDGER: &str = "mxzaz-hqaaa-aaaar-qaada-cai";
const CKBTC_MINTER: &str = "mqygn-kiaaa-aaaar-qaadq-cai";

#[derive(CandidType, Deserialize)]
struct GetBtcAddressArgs { owner: Option<Principal>, subaccount: Option<Vec<u8>> }

#[derive(CandidType, Deserialize)]
struct UpdateBalanceArgs { owner: Option<Principal>, subaccount: Option<Vec<u8>> }

fn principal_to_subaccount(principal: &Principal) -> [u8; 32] {
    let mut subaccount = [0u8; 32];
    let principal_bytes = principal.as_slice();
    subaccount[0] = principal_bytes.len() as u8;
    subaccount[1..1 + principal_bytes.len()].copy_from_slice(principal_bytes);
    subaccount
}

fn ledger_id() -> Principal { Principal::from_text(CKBTC_LEDGER).unwrap() }
fn minter_id() -> Principal { Principal::from_text(CKBTC_MINTER).unwrap() }

#[update]
async fn get_deposit_address() -> String {
    let caller = ic_cdk::api::msg_caller();
    assert_ne!(caller, Principal::anonymous(), "Authentication required");
    let subaccount = principal_to_subaccount(&caller);
    let args = GetBtcAddressArgs {
        owner: Some(ic_cdk::api::canister_self()),
        subaccount: Some(subaccount.to_vec()),
    };
    let (address,): (String,) = Call::unbounded_wait(minter_id(), "get_btc_address")
        .with_arg(args).await.expect("Failed to get BTC address")
        .candid_tuple().expect("Failed to decode response");
    address
}

#[update]
async fn transfer(to: Principal, amount: Nat) -> Result<Nat, TransferError> {
    let caller = ic_cdk::api::msg_caller();
    assert_ne!(caller, Principal::anonymous(), "Authentication required");
    let from_subaccount = principal_to_subaccount(&caller);
    let args = TransferArg {
        from_subaccount: Some(from_subaccount),
        to: Account { owner: to, subaccount: None },
        amount,
        fee: Some(Nat::from(10u64)), // 10 satoshis
        memo: None,
        created_at_time: None,
    };
    let (result,): (Result<Nat, TransferError>,) =
        Call::unbounded_wait(ledger_id(), "icrc1_transfer")
            .with_arg(args).await.expect("Failed to call icrc1_transfer")
            .candid_tuple().expect("Failed to decode response");
    result
}
```
