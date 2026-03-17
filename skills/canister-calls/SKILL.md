---
name: canister-calls
description: "Discover and call any Internet Computer canister. Covers retrieving Candid interfaces from deployed canisters (both off-chain and via inter-canister calls), reading type signatures, generating typed client bindings, and constructing calls using any IC agent library. Includes curated workflows for well-known infrastructure canisters (ICRC ledgers, ckBTC minter, EVM RPC). Use when making any canister call, exploring an unfamiliar canister's API, integrating with IC infrastructure canisters, working with token transfers, ckBTC deposits/withdrawals, or Ethereum/EVM calls from IC."
license: Apache-2.0
compatibility: "icp-cli >= 0.1.0"
metadata:
  title: Canister Calls & Interface Discovery
  category: Integration
---

# Canister Calls & Interface Discovery

## What This Is

Every canister on the Internet Computer exposes a Candid interface — a typed API description embedded in the WASM module. Candid is to canisters what `--help` is to CLI tools: the standard way to discover what a canister can do and how to call it. This skill teaches you how to retrieve, read, and use Candid interfaces to call any canister, plus curated workflows for well-known infrastructure canisters where raw Candid alone isn't enough.

## Prerequisites

- For Motoko: `mops` package manager, `core = "2.0.0"` in mops.toml
- For Rust: `ic-cdk >= 0.19`, `candid >= 0.10`
- For JavaScript/TypeScript: `@icp-sdk/core` (runtime), `@icp-sdk/bindgen` (codegen)
- For Rust bindings: `ic-cdk-bindgen` (build-time Candid-to-Rust codegen)

## Discovering a Canister's Interface

### From Outside IC (Off-Chain)

Retrieve the Candid interface of any deployed canister:

```bash
# Fetch the .did file from a deployed canister (local or mainnet)
icp canister metadata <CANISTER_ID> candid:service -e ic

# Example: get the ICP ledger's interface
icp canister metadata ryjl3-tyaaa-aaaaa-aaaba-cai candid:service -e ic
```

This returns the full Candid service definition with all method signatures, types, and documentation comments (if the canister author included them).

### From Inside a Canister (Inter-Canister)

When your canister needs to call another canister dynamically, you can fetch its Candid interface at runtime using the management canister:

```bash
# The management canister exposes canister metadata
icp canister call aaaaa-aa canister_metadata '(record { canister_id = principal "<CANISTER_ID>"; path = "candid:service" })' -e ic
```

### Reading Candid Interfaces

A Candid interface describes:
- **Method names** and whether they are `query` (fast, read-only) or `update` (consensus-based, can mutate state)
- **Argument types** and **return types** — fully typed, including records, variants, optionals, vectors
- **Documentation comments** (if the canister author included them, prefixed with `///` in the .did file)

Example Candid snippet:
```candid
service : {
  icrc1_transfer : (TransferArg) -> (variant { Ok : nat; Err : TransferError });
  icrc1_balance_of : (Account) -> (nat) query;
  icrc1_fee : () -> (nat) query;
}
```

This tells you: `icrc1_transfer` is an update call taking `TransferArg` and returning a result variant. `icrc1_balance_of` is a query call. The types (`TransferArg`, `Account`, `TransferError`) are defined elsewhere in the same .did file.

### Generating Typed Client Bindings

Each language has a dedicated tool for generating typed bindings from .did files:

#### Rust

Use `ic-cdk-bindgen` to generate typed Rust bindings from .did files at build time. Add it to your `build-dependencies` in `Cargo.toml` and configure it in `build.rs`. See https://crates.io/crates/ic-cdk-bindgen for setup.

#### JavaScript / TypeScript

Use `@icp-sdk/bindgen` to generate typed JS/TS bindings from .did files:

```bash
npx @icp-sdk/bindgen --canister <CANISTER_ID> -e ic
```

See https://www.npmjs.com/package/@icp-sdk/bindgen for options.

### Calling Any Canister via CLI

Once you know the method signature from the Candid interface:

```bash
# Call any method on any canister
icp canister call <CANISTER_ID> <METHOD_NAME> '(<CANDID_ARGS>)' -e ic

# Query call (faster, read-only)
icp canister call <CANISTER_ID> <METHOD_NAME> '(<CANDID_ARGS>)' --query -e ic
```

### Calling Any Canister from Code

#### Motoko — Dynamic Actor Reference

```motoko
// Reference a remote canister by principal with a typed interface
transient let remote = actor ("aaaaa-bbbbb-ccccc-ddddd-cai") : actor {
  some_method : shared (Nat) -> async Text;
  some_query : shared query () -> async Nat;
};

// Call it
let result = await remote.some_method(42);
```

#### Rust — Using ic-cdk Call API

```rust
use ic_cdk::call::Call;
use candid::Principal;

let canister_id = Principal::from_text("aaaaa-bbbbb-ccccc-ddddd-cai").unwrap();

// Unbounded wait (guaranteed response)
let (result,): (String,) = Call::unbounded_wait(canister_id, "some_method")
    .with_arg(42u64)
    .await
    .expect("Call failed")
    .candid_tuple()
    .expect("Decode failed");
```

## What Candid Doesn't Tell You

Candid gives you the shape of an API but not the workflow. For well-known infrastructure canisters, you need to know:
- **Which canisters to call and in what order** (e.g., ckBTC deposit is a multi-step flow across minter + ledger)
- **Cycle costs** (e.g., EVM RPC requires cycles attached to calls)
- **Fee amounts and units** (e.g., ICP fee is 10,000 e8s, not 10,000 ICP)
- **Pitfalls that cause silent failures** (e.g., forgetting `update_balance` after a BTC deposit)

The reference files below contain this curated knowledge for each well-known canister.

## Well-Known Canister Registry

| Canister | ID (Mainnet) | What It Does | Reference |
|----------|-------------|-------------|-----------|
| ICP Ledger | `ryjl3-tyaaa-aaaaa-aaaba-cai` | ICP token transfers, balances, ICRC-1/2 | `references/icrc-ledger.md` |
| ckBTC Ledger | `mxzaz-hqaaa-aaaar-qaada-cai` | ckBTC token transfers | `references/icrc-ledger.md` |
| ckBTC Minter | `mqygn-kiaaa-aaaar-qaadq-cai` | BTC deposit/withdrawal via ckBTC | `references/ckbtc.md` |
| ckETH Ledger | `ss2fx-dyaaa-aaaar-qacoq-cai` | ckETH token transfers | `references/icrc-ledger.md` |
| EVM RPC | `7hfb6-caaaa-aaaar-qadga-cai` | Ethereum/EVM JSON-RPC proxy | `references/evm-rpc.md` |

**For any canister not listed here**, use the Candid discovery flow above: fetch the .did, read the types, generate bindings, and call.

### When to Read a Reference File

- **Making token transfers (ICP, ckBTC, ckETH)** or working with **ICRC-1/ICRC-2 approve/transferFrom** -> Read `references/icrc-ledger.md`
- **Integrating Bitcoin** (BTC deposits, ckBTC minting, BTC withdrawals) -> Read `references/ckbtc.md`
- **Calling Ethereum/EVM chains** (ETH balances, ERC-20 reads, sending transactions) -> Read `references/evm-rpc.md`
