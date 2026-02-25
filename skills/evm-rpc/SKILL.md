---
name: evm-rpc
description: Use when building apps that read from or write to Ethereum and EVM-compatible chains from the Internet Computer. Covers EVM RPC canister setup, eth_getBalance, eth_call, eth_sendRawTransaction, multi-provider consensus, and cycle costs.
---

# EVM RPC Canister — Calling Ethereum from IC
> version: 1.0.0 | requires: [dfx >= 0.24.0, mops, ic-cdk >= 0.17]

## What This Is

The EVM RPC canister is an IC system canister that proxies JSON-RPC calls to Ethereum and EVM-compatible chains via HTTPS outcalls. Your canister sends a request to the EVM RPC canister, which fans it out to multiple RPC providers, compares responses for consensus, and returns the result. No API keys required for default providers. No bridges or oracles needed.

## Prerequisites

- `dfx` >= 0.24.0
- For Motoko: `mops` package manager, `core = "2.0.0"` in mops.toml
- For Rust: `ic-cdk`, `candid`, `serde`
- Cycles in your canister (each RPC call costs cycles)

## Canister IDs

| Canister | ID | Subnet |
|---|---|---|
| EVM RPC (mainnet) | `7hfb6-caaaa-aaaar-qadga-cai` | 34-node fiduciary |

## Supported Chains

| Chain | RpcServices Variant | Chain ID |
|---|---|---|
| Ethereum Mainnet | `#EthMainnet` | 1 |
| Ethereum Sepolia | `#EthSepolia` | 11155111 |
| Arbitrum One | `#ArbitrumOne` | 42161 |
| Base Mainnet | `#BaseMainnet` | 8453 |
| Optimism Mainnet | `#OptimismMainnet` | 10 |
| Custom EVM chain | `#Custom` | any |

## RPC Providers

Built-in providers (no API key needed for defaults):

| Provider | Ethereum | Sepolia | Arbitrum | Base | Optimism |
|---|---|---|---|---|---|
| Alchemy | yes | yes | - | - | - |
| Ankr | yes | - | yes | yes | yes |
| BlockPi | yes | yes | yes | yes | yes |
| Cloudflare | yes | - | - | - | - |
| LlamaNodes | yes | - | - | - | - |
| PublicNode | yes | yes | yes | yes | yes |

## Cycle Costs

**Formula:**
```
(5_912_000 + 60_000 * nodes + 2400 * request_bytes + 800 * max_response_bytes) * nodes * rpc_count
```

Where `nodes` = 34 (fiduciary subnet), `rpc_count` = number of providers queried.

**Practical guidance:** Send 10_000_000_000 cycles (10B) as a starting budget. Unused cycles are refunded. Typical calls cost 100M-1B cycles (~$0.0001-$0.001 USD).

Use `requestCost` to get an exact estimate before calling.

## Mistakes That Break Your Build

1. **Not sending enough cycles.** Every EVM RPC call requires cycles attached. If you send too few, the call fails silently or traps. Start with 10B cycles and adjust down after verifying.

2. **Ignoring the `Inconsistent` result variant.** Multi-provider calls return `#Consistent(result)` or `#Inconsistent(results)`. If providers disagree, you get `Inconsistent`. Always handle both arms or your canister traps on provider disagreement.

3. **Using wrong chain variant.** `#EthMainnet` is for Ethereum L1. For Arbitrum use `#ArbitrumOne`, for Base use `#BaseMainnet`. Using the wrong variant queries the wrong chain.

4. **Forgetting `null` for optional config.** The second argument to every RPC method is an optional config record. Pass `null` for defaults. Omitting it causes a Candid type mismatch.

5. **Response size limits.** Large responses (e.g., `eth_getLogs` with broad filters) can exceed the max response size. Set `max_response_bytes` appropriately or the call fails.

6. **Calling `eth_sendRawTransaction` without signing first.** The EVM RPC canister does not sign transactions. You must sign the transaction yourself (using threshold ECDSA via the IC management canister) and pass the raw signed bytes.

7. **Using `Cycles.add` instead of `await (with cycles = ...)` in mo:core.** In modern Motoko with mo:core, attach cycles using `await (with cycles = AMOUNT) canister.method(args)`. The old `Cycles.add<system>(amount)` pattern from mo:base still works but the inline syntax is preferred for clarity.

## Implementation

### dfx.json Configuration

#### Option A: Pull from mainnet (recommended for production)

```json
{
  "canisters": {
    "evm_rpc": {
      "type": "pull",
      "id": "7hfb6-caaaa-aaaar-qadga-cai"
    },
    "backend": {
      "type": "motoko",
      "main": "src/backend/main.mo",
      "dependencies": ["evm_rpc"]
    }
  }
}
```

Then run:
```bash
dfx deps pull
dfx deps init evm_rpc --argument '(record {})'
dfx deps deploy
```

#### Option B: Custom wasm (for local development)

```json
{
  "canisters": {
    "evm_rpc": {
      "type": "custom",
      "candid": "https://github.com/internet-computer-protocol/evm-rpc-canister/releases/latest/download/evm_rpc.did",
      "wasm": "https://github.com/internet-computer-protocol/evm-rpc-canister/releases/latest/download/evm_rpc.wasm.gz",
      "remote": {
        "id": {
          "ic": "7hfb6-caaaa-aaaar-qadga-cai"
        }
      }
    },
    "backend": {
      "type": "motoko",
      "main": "src/backend/main.mo",
      "dependencies": ["evm_rpc"]
    }
  }
}
```

### Motoko

#### mops.toml

```toml
[package]
name = "evm-rpc-app"
version = "0.1.0"

[dependencies]
core = "2.0.0"
```

#### src/backend/main.mo — Get ETH Balance

```motoko
import EvmRpc "canister:evm_rpc";
import Cycles "mo:core/Cycles";
import Runtime "mo:core/Runtime";

persistent actor {

  // Get ETH balance for an address on Ethereum mainnet
  public func getEthBalance(address : Text) : async Text {
    let services = #EthMainnet(null); // Use all default providers
    let config = null;

    // eth_call with balance check via raw JSON-RPC
    let json = "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"" # address # "\",\"latest\"],\"id\":1}";
    let maxResponseBytes : Nat64 = 1000;

    // Get exact cost first
    let cyclesResult = await EvmRpc.requestCost(#EthMainnet(#PublicNode), json, maxResponseBytes);
    let cost = switch (cyclesResult) {
      case (#Ok(c)) { c };
      case (#Err(err)) { Runtime.trap("requestCost failed: " # debug_show err) };
    };

    let result = await (with cycles = cost) EvmRpc.request(
      #EthMainnet(#PublicNode),
      json,
      maxResponseBytes
    );

    switch (result) {
      case (#Ok(response)) { response };
      case (#Err(err)) { Runtime.trap("RPC error: " # debug_show err) };
    }
  };

  // Get latest block using the typed API
  public func getLatestBlock() : async ?EvmRpc.Block {
    let services = #EthMainnet(null);
    let config = null;

    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_getBlockByNumber(
      services,
      config,
      #Latest
    );

    switch (result) {
      case (#Consistent(#Ok(block))) { ?block };
      case (#Consistent(#Err(error))) {
        Runtime.trap("Error: " # debug_show error);
      };
      case (#Inconsistent(_results)) {
        Runtime.trap("Providers returned inconsistent results");
      };
    }
  };

  // Read ERC-20 token balance (e.g., USDC on Ethereum)
  // Function selector for balanceOf(address): 0x70a08231
  // Pad address to 32 bytes (remove 0x prefix, left-pad with zeros)
  public func getErc20Balance(tokenContract : Text, walletAddress : Text) : async ?Text {
    let services = #EthMainnet(null);
    let config = null;

    // Encode: balanceOf(address) = 0x70a08231 + address padded to 32 bytes
    // walletAddress should be like "0xABC..." — strip 0x and left-pad to 64 hex chars
    let addressHex = if (walletAddress.size() > 2) {
      // Simple: assume address is already 0x-prefixed 40-char hex
      let stripped = switch (walletAddress.chars().next()) {
        case (?"0") { /* skip 0x prefix handling in real code */ walletAddress };
        case _ { walletAddress };
      };
      stripped
    } else { walletAddress };

    let calldata = "0x70a08231000000000000000000000000" # stripHexPrefix(walletAddress);

    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_call(
      services,
      config,
      {
        block = null;
        transaction = {
          to = ?tokenContract;
          input = ?calldata;
          // All optional fields set to null
          accessList = null;
          blobVersionedHashes = null;
          blobs = null;
          chainId = null;
          from = null;
          gas = null;
          gasPrice = null;
          maxFeePerBlobGas = null;
          maxFeePerGas = null;
          maxPriorityFeePerGas = null;
          nonce = null;
          type_ = null;
          value = null;
        };
      }
    );

    switch (result) {
      case (#Consistent(#Ok(response))) { ?response };
      case (#Consistent(#Err(error))) {
        Runtime.trap("eth_call error: " # debug_show error);
      };
      case (#Inconsistent(_)) {
        Runtime.trap("Inconsistent results from providers");
      };
    }
  };

  // Helper: strip "0x" prefix from hex string
  func stripHexPrefix(hex : Text) : Text {
    let chars = hex.chars();
    switch (chars.next(), chars.next()) {
      case (?"0", ?"x") {
        var rest = "";
        for (c in chars) { rest #= Text.fromChar(c) };
        rest
      };
      case _ { hex };
    }
  };

  // Send a signed raw transaction
  public func sendRawTransaction(signedTxHex : Text) : async ?EvmRpc.SendRawTransactionStatus {
    let services = #EthMainnet(null);
    let config = null;

    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_sendRawTransaction(
      services,
      config,
      signedTxHex
    );

    switch (result) {
      case (#Consistent(#Ok(status))) { ?status };
      case (#Consistent(#Err(error))) {
        Runtime.trap("sendRawTransaction error: " # debug_show error);
      };
      case (#Inconsistent(_)) {
        Runtime.trap("Inconsistent results");
      };
    }
  };

  // Get transaction receipt
  public func getTransactionReceipt(txHash : Text) : async ?EvmRpc.TransactionReceipt {
    let services = #EthMainnet(null);
    let config = null;

    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_getTransactionReceipt(
      services,
      config,
      txHash
    );

    switch (result) {
      case (#Consistent(#Ok(receipt))) { receipt };
      case (#Consistent(#Err(error))) {
        Runtime.trap("Error: " # debug_show error);
      };
      case (#Inconsistent(_)) {
        Runtime.trap("Inconsistent results");
      };
    }
  };

  // Using a specific provider (instead of multi-provider consensus)
  public func getBalanceViaPublicNode(address : Text) : async Text {
    let json = "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"" # address # "\",\"latest\"],\"id\":1}";
    let maxResponseBytes : Nat64 = 1000;

    let result = await (with cycles = 10_000_000_000) EvmRpc.request(
      #EthMainnet(#PublicNode),  // Single specific provider
      json,
      maxResponseBytes
    );

    switch (result) {
      case (#Ok(response)) { response };
      case (#Err(err)) { Runtime.trap("Error: " # debug_show err) };
    }
  };

  // Querying a different chain (Arbitrum)
  public func getArbitrumBlock() : async ?EvmRpc.Block {
    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_getBlockByNumber(
      #ArbitrumOne(null), // Arbitrum One
      null,
      #Latest
    );

    switch (result) {
      case (#Consistent(#Ok(block))) { ?block };
      case (#Consistent(#Err(error))) {
        Runtime.trap("Error: " # debug_show error);
      };
      case (#Inconsistent(_)) {
        Runtime.trap("Inconsistent results");
      };
    }
  };

  // Using a custom RPC endpoint
  public func getBalanceCustomRpc(address : Text, rpcUrl : Text) : async Text {
    let json = "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"" # address # "\",\"latest\"],\"id\":1}";

    let result = await (with cycles = 10_000_000_000) EvmRpc.request(
      #Custom({ url = rpcUrl; headers = null }),
      json,
      1000
    );

    switch (result) {
      case (#Ok(response)) { response };
      case (#Err(err)) { Runtime.trap("Error: " # debug_show err) };
    }
  };
};
```

### Rust

#### Cargo.toml

```toml
[package]
name = "evm_rpc_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.17"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

#### src/lib.rs

```rust
use candid::{CandidType, Deserialize, Principal};
use ic_cdk::api::call::call_with_payment128;
use ic_cdk::update;

const EVM_RPC_CANISTER: &str = "7hfb6-caaaa-aaaar-qadga-cai";

fn evm_rpc_id() -> Principal {
    Principal::from_text(EVM_RPC_CANISTER).unwrap()
}

// -- Types matching the EVM RPC canister Candid interface --

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcServices {
    EthMainnet(Option<Vec<EthMainnetService>>),
    EthSepolia(Option<Vec<EthSepoliaService>>),
    ArbitrumOne(Option<Vec<L2MainnetService>>),
    BaseMainnet(Option<Vec<L2MainnetService>>),
    OptimismMainnet(Option<Vec<L2MainnetService>>),
    Custom {
        #[serde(rename = "chainId")]
        chain_id: u64,
        services: Vec<CustomRpcService>,
    },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcService {
    EthMainnet(EthMainnetService),
    EthSepolia(EthSepoliaService),
    ArbitrumOne(L2MainnetService),
    BaseMainnet(L2MainnetService),
    OptimismMainnet(L2MainnetService),
    Custom(CustomRpcService),
    Chain(u64),
    Provider(u64),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum EthMainnetService {
    Alchemy,
    Ankr,
    BlockPi,
    Cloudflare,
    Llama,
    PublicNode,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum EthSepoliaService {
    Alchemy,
    BlockPi,
    PublicNode,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum L2MainnetService {
    Alchemy,
    Ankr,
    BlockPi,
    Llama,
    PublicNode,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct CustomRpcService {
    url: String,
    headers: Option<Vec<(String, String)>>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum BlockTag {
    Latest,
    Safe,
    Finalized,
    Earliest,
    Pending,
    Number(candid::Nat),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum MultiResult<T> {
    Consistent(RpcResult<T>),
    Inconsistent(Vec<(RpcService, RpcResult<T>)>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcResult<T> {
    Ok(T),
    Err(RpcError),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcError {
    ProviderError(ProviderError),
    HttpOutcallError(HttpOutcallError),
    JsonRpcError(JsonRpcError),
    ValidationError(ValidationError),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum ProviderError {
    TooFewCycles { expected: candid::Nat, received: candid::Nat },
    MissingRequiredProvider,
    ProviderNotFound,
    NoPermission,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum HttpOutcallError {
    IcError { code: i32, message: String },
    InvalidHttpJsonRpcResponse { status: u16, body: String, parsing_error: Option<String> },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct JsonRpcError {
    code: i64,
    message: String,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum ValidationError {
    HostNotAllowed(String),
    UrlParseError(String),
    Custom(String),
    CredentialPathNotAllowed,
    CredentialHeaderNotAllowed,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct Block {
    #[serde(rename = "baseFeePerGas")]
    base_fee_per_gas: Option<candid::Nat>,
    number: candid::Nat,
    difficulty: Option<candid::Nat>,
    #[serde(rename = "extraData")]
    extra_data: String,
    #[serde(rename = "gasLimit")]
    gas_limit: candid::Nat,
    #[serde(rename = "gasUsed")]
    gas_used: candid::Nat,
    hash: String,
    #[serde(rename = "logsBloom")]
    logs_bloom: String,
    miner: String,
    #[serde(rename = "mixHash")]
    mix_hash: String,
    nonce: candid::Nat,
    #[serde(rename = "parentHash")]
    parent_hash: String,
    #[serde(rename = "receiptsRoot")]
    receipts_root: String,
    #[serde(rename = "sha3Uncles")]
    sha3_uncles: String,
    size: candid::Nat,
    #[serde(rename = "stateRoot")]
    state_root: String,
    timestamp: candid::Nat,
    #[serde(rename = "totalDifficulty")]
    total_difficulty: Option<candid::Nat>,
    transactions: Vec<String>,
    #[serde(rename = "transactionsRoot")]
    transactions_root: Option<String>,
    uncles: Vec<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum SendRawTransactionStatus {
    Ok(Option<String>),
    InsufficientFunds,
    NonceTooLow,
    NonceTooHigh,
}

// -- Get ETH balance via raw JSON-RPC --

#[update]
async fn get_eth_balance(address: String) -> String {
    let json = format!(
        r#"{{"jsonrpc":"2.0","method":"eth_getBalance","params":["{}","latest"],"id":1}}"#,
        address
    );
    let max_response_bytes: u64 = 1000;
    let cycles: u128 = 10_000_000_000;

    let (result,): (Result<String, RpcError>,) = call_with_payment128(
        evm_rpc_id(),
        "request",
        (
            RpcService::EthMainnet(EthMainnetService::PublicNode),
            json,
            max_response_bytes,
        ),
        cycles,
    )
    .await
    .expect("Failed to call EVM RPC canister");

    match result {
        Ok(response) => response,
        Err(err) => ic_cdk::trap(&format!("RPC error: {:?}", err)),
    }
}

// -- Get latest block via typed API --

#[update]
async fn get_latest_block() -> Block {
    let cycles: u128 = 10_000_000_000;

    let (result,): (MultiResult<Block>,) = call_with_payment128(
        evm_rpc_id(),
        "eth_getBlockByNumber",
        (
            RpcServices::EthMainnet(None),
            None::<()>,  // config
            BlockTag::Latest,
        ),
        cycles,
    )
    .await
    .expect("Failed to call eth_getBlockByNumber");

    match result {
        MultiResult::Consistent(RpcResult::Ok(block)) => block,
        MultiResult::Consistent(RpcResult::Err(err)) => {
            ic_cdk::trap(&format!("RPC error: {:?}", err))
        }
        MultiResult::Inconsistent(_) => {
            ic_cdk::trap("Providers returned inconsistent results")
        }
    }
}

// -- Read ERC-20 balance --

#[update]
async fn get_erc20_balance(token_contract: String, wallet_address: String) -> String {
    // balanceOf(address) selector: 0x70a08231
    // Pad the address to 32 bytes (strip 0x, left-pad with zeros)
    let addr = wallet_address.trim_start_matches("0x");
    let calldata = format!("0x70a08231{:0>64}", addr);

    let json = format!(
        r#"{{"jsonrpc":"2.0","method":"eth_call","params":[{{"to":"{}","data":"{}"}},"latest"],"id":1}}"#,
        token_contract, calldata
    );
    let cycles: u128 = 10_000_000_000;

    let (result,): (Result<String, RpcError>,) = call_with_payment128(
        evm_rpc_id(),
        "request",
        (
            RpcService::EthMainnet(EthMainnetService::PublicNode),
            json,
            2048_u64,
        ),
        cycles,
    )
    .await
    .expect("Failed to call EVM RPC canister");

    match result {
        Ok(response) => response,
        Err(err) => ic_cdk::trap(&format!("RPC error: {:?}", err)),
    }
}

// -- Send signed raw transaction --

#[update]
async fn send_raw_transaction(signed_tx_hex: String) -> SendRawTransactionStatus {
    let cycles: u128 = 10_000_000_000;

    let (result,): (MultiResult<SendRawTransactionStatus>,) = call_with_payment128(
        evm_rpc_id(),
        "eth_sendRawTransaction",
        (
            RpcServices::EthMainnet(None),
            None::<()>,
            signed_tx_hex,
        ),
        cycles,
    )
    .await
    .expect("Failed to call eth_sendRawTransaction");

    match result {
        MultiResult::Consistent(RpcResult::Ok(status)) => status,
        MultiResult::Consistent(RpcResult::Err(err)) => {
            ic_cdk::trap(&format!("RPC error: {:?}", err))
        }
        MultiResult::Inconsistent(_) => {
            ic_cdk::trap("Providers returned inconsistent results")
        }
    }
}

// -- Query Arbitrum (different chain example) --

#[update]
async fn get_arbitrum_block() -> Block {
    let cycles: u128 = 10_000_000_000;

    let (result,): (MultiResult<Block>,) = call_with_payment128(
        evm_rpc_id(),
        "eth_getBlockByNumber",
        (
            RpcServices::ArbitrumOne(None),
            None::<()>,
            BlockTag::Latest,
        ),
        cycles,
    )
    .await
    .expect("Failed to call eth_getBlockByNumber");

    match result {
        MultiResult::Consistent(RpcResult::Ok(block)) => block,
        MultiResult::Consistent(RpcResult::Err(err)) => {
            ic_cdk::trap(&format!("RPC error: {:?}", err))
        }
        MultiResult::Inconsistent(_) => {
            ic_cdk::trap("Inconsistent results")
        }
    }
}

ic_cdk::export_candid!();
```

## Deploy & Test

### Local Development

```bash
# Start dfx
dfx start --background

# Pull the EVM RPC canister
dfx deps pull
dfx deps init evm_rpc --argument '(record {})'
dfx deps deploy

# Deploy your backend
dfx deploy backend
```

### Deploy to Mainnet

```bash
# On mainnet, the EVM RPC canister is already deployed.
# Your canister calls it directly by principal.
dfx deploy backend --network ic
```

### Test via dfx CLI

```bash
# Set up variables
export WALLET=$(dfx identity get-wallet)
export CYCLES=10000000000

# Get ETH balance (raw JSON-RPC via single provider)
dfx canister call evm_rpc request '(
  variant { EthMainnet = variant { PublicNode } },
  "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\",\"latest\"],\"id\":1}",
  1000
)' --with-cycles=$CYCLES --wallet=$WALLET

# Get latest block (typed API, multi-provider)
dfx canister call evm_rpc eth_getBlockByNumber '(
  variant { EthMainnet = null },
  null,
  variant { Latest }
)' --with-cycles=$CYCLES --wallet=$WALLET

# Get transaction receipt
dfx canister call evm_rpc eth_getTransactionReceipt '(
  variant { EthMainnet = null },
  null,
  "0xdd5d4b18923d7aae953c7996d791118102e889bea37b48a651157a4890e4746f"
)' --with-cycles=$CYCLES --wallet=$WALLET

# Check available providers
dfx canister call evm_rpc getProviders

# Estimate cost before calling
dfx canister call evm_rpc requestCost '(
  variant { EthMainnet = variant { PublicNode } },
  "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\",\"latest\"],\"id\":1}",
  1000
)'
```

## Verify It Works

### Check ETH Balance

```bash
dfx canister call backend get_eth_balance '("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")'
# Expected: JSON string like '{"jsonrpc":"2.0","id":1,"result":"0x..."}'
# The result is the balance in wei (hex encoded)
```

### Check Latest Block

```bash
dfx canister call backend get_latest_block
# Expected: record { number = ...; hash = "0x..."; timestamp = ...; ... }
```

### Check ERC-20 Balance (USDC)

```bash
# USDC contract on Ethereum: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
dfx canister call backend get_erc20_balance '(
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
)'
# Expected: JSON with hex-encoded uint256 balance
```

### Verify Cycle Refunds

Check your canister cycle balance before and after an RPC call:

```bash
# Before
dfx canister status backend --network ic

# Make a call
dfx canister call backend get_eth_balance '("0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045")' --network ic

# After — unused cycles from the 10B budget are refunded
dfx canister status backend --network ic
```
