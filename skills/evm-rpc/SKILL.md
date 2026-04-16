---
name: evm-rpc
description: "Call Ethereum and EVM chains from IC canisters (Rust) via the EVM RPC canister using the evm_rpc_client crate. Covers typed API calls, raw JSON-RPC, multi-provider consensus, ERC-20 reads, and sending pre-signed transactions. Use when calling Ethereum, Arbitrum, Base, Optimism, or any EVM chain from a Rust canister. Do NOT use for generic HTTPS calls to non-EVM APIs — use https-outcalls instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2"
metadata:
  title: EVM RPC
  category: Integration
---

# EVM RPC Canister — Calling Ethereum from IC

## What This Is

The EVM RPC canister is an IC system canister that proxies JSON-RPC calls to Ethereum and EVM-compatible chains via HTTPS outcalls. Your canister sends a request to the EVM RPC canister, which fans it out to multiple RPC providers, compares responses for consensus, and returns the result. No API keys required for default providers. No bridges or oracles needed.

## Prerequisites

- `evm_rpc_client` crate (provides typed client API and re-exports `evm_rpc_types`)

## Canister IDs

| Canister | ID | Subnet |
|---|---|---|
| EVM RPC (mainnet) | `7hfb6-caaaa-aaaar-qadga-cai` | 34-node fiduciary |

Candid interface: `https://github.com/dfinity/evm-rpc-canister/releases/latest/download/evm_rpc.did` — or use the `canhelp` skill to fetch it directly from the mainnet canister.

## Supported Chains

| Chain | Chain ID | Candid | Rust |
|---|---|---|---|
| Ethereum Mainnet | 1 | `variant { EthMainnet }` | `RpcServices::EthMainnet` |
| Ethereum Sepolia | 11155111 | `variant { EthSepolia }` | `RpcServices::EthSepolia` |
| Arbitrum One | 42161 | `variant { ArbitrumOne }` | `RpcServices::ArbitrumOne` |
| Base Mainnet | 8453 | `variant { BaseMainnet }` | `RpcServices::BaseMainnet` |
| Optimism Mainnet | 10 | `variant { OptimismMainnet }` | `RpcServices::OptimismMainnet` |
| Custom EVM chain | any | `variant { Custom }` | `RpcServices::Custom` |

## RPC Providers

Built-in providers (no API key needed for defaults):

| Provider | Ethereum | Sepolia | Arbitrum | Base | Optimism |
|---|---|---|---|---|---|
| Alchemy | yes | yes | yes | yes | yes |
| Ankr | yes | - | yes | yes | yes |
| BlockPi | yes | yes | yes | yes | yes |
| Cloudflare | yes | - | - | - | - |
| LlamaNodes | yes | - | yes | yes | yes |
| PublicNode | yes | yes | yes | yes | yes |

## Cycle Costs

**Formula:**
```
(5_912_000 + 60_000 * nodes + 2400 * request_bytes + 800 * max_response_bytes) * nodes * rpc_count
```

Where `nodes` = 34 (fiduciary subnet), `rpc_count` = number of providers queried.

**Practical guidance:** Send 10_000_000_000 cycles (10B) as a starting budget. Unused cycles are refunded. Typical calls cost 100M-1B cycles (~$0.0001-$0.001 USD).

Use `requestCost` to get an exact estimate before calling.

## Pitfalls

1. **Not sending enough cycles.** Every EVM RPC call requires cycles attached. The `evm_rpc_client` defaults to 10B cycles per call, but if you override with `.with_cycles()`, sending too few causes silent failures or traps.

2. **Using default `Equality` consensus.** The default consensus strategy requires all providers to return identical responses. This fails for queries like `eth_getBlockByNumber(Latest)` where providers are often 1-2 blocks apart. Use `ConsensusStrategy::Threshold { total: Some(3), min: 2 }` (2-of-3 agreement) for most use cases.

3. **Ignoring the `Inconsistent` result variant.** Even with threshold consensus, providers can still disagree beyond the threshold. Multi-provider calls return `MultiRpcResult::Consistent(result)` or `MultiRpcResult::Inconsistent(results)`. Always handle both arms or your canister traps on provider disagreement.

4. **Using wrong chain variant.** `RpcServices::EthMainnet` is for Ethereum L1. For Arbitrum use `RpcServices::ArbitrumOne`, for Base use `RpcServices::BaseMainnet`. Using the wrong variant queries the wrong chain.

5. **Response size limits.** Large responses (e.g., `eth_getLogs` with broad filters) can exceed the max response size. Use `.with_response_size_estimate()` on the client builder or the call fails.

6. **Calling `eth_sendRawTransaction` without signing first.** The EVM RPC canister does not sign transactions. You must sign the transaction yourself (using threshold ECDSA via the IC management canister) and pass the raw signed bytes.

7. **Defining EVM RPC Candid types manually.** Use the `evm_rpc_client` crate which provides a typed client API and re-exports all Candid types from `evm_rpc_types`. Manual type definitions drift from the canister's actual interface and cause `IC0503` decode traps at runtime.

## Implementation

### icp.yaml Configuration

The `evm_rpc` canister definition is only needed for local development — the local replica doesn't have the EVM RPC canister pre-installed, so you deploy your own copy from the pre-built WASM. On mainnet, the DFINITY-maintained canister is already deployed at `7hfb6-caaaa-aaaar-qadga-cai` — do NOT deploy your own instance. Use environments to control which canisters are deployed where:

```yaml
canisters:
  - name: backend
    recipe:
      type: "@dfinity/rust@v3.2.0"
      configuration:
        package: backend
  - name: evm_rpc
    build:
      steps:
        - type: pre-built
          url: https://github.com/dfinity/evm-rpc-canister/releases/latest/download/evm_rpc.wasm.gz
    init_args: "(record {})"

environments:
  - name: local
    network: local
    canisters: [backend, evm_rpc]
  - name: ic
    network: ic
    canisters: [backend]
    settings:
      backend:
        environment_variables:
          PUBLIC_CANISTER_ID:evm_rpc: "7hfb6-caaaa-aaaar-qadga-cai"
```

### Rust

The `evm_rpc_client` crate provides a typed client API for calling the EVM RPC canister. It handles cycle attachment, argument encoding, and response decoding. All Candid types are re-exported from `evm_rpc_types`. For projects using the Alloy ecosystem, enable the `alloy` Cargo feature to use Alloy-native request/response types.

#### Cargo.toml

```toml
[package]
name = "evm_rpc_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
evm_rpc_client = "0.4"
evm_rpc_types = "3"
ic-canister-runtime = "0.2"
ic-cdk = "0.20"
candid = "0.10"
serde_json = "1"
```

#### src/lib.rs

```rust
use candid::Principal;
use evm_rpc_client::{CandidResponseConverter, EvmRpcClient, NoRetry};
use evm_rpc_types::{
    Block, BlockTag, CallArgs, ConsensusStrategy,
    Hex, Hex20, Hex32, MultiRpcResult, RpcServices, SendRawTransactionStatus,
};
use ic_canister_runtime::IcRuntime;
use ic_cdk::update;
use std::str::FromStr;

// Resolve the EVM RPC canister ID from environment variable injected by icp-cli.
// Locally: auto-injected with the locally deployed evm_rpc canister ID.
// Mainnet: set explicitly in icp.yaml to the well-known canister ID.
fn client() -> EvmRpcClient<IcRuntime, CandidResponseConverter, NoRetry> {
    let canister_id = Principal::from_text(
        ic_cdk::api::env_var_value("PUBLIC_CANISTER_ID:evm_rpc"),
    )
    .expect("Invalid principal in PUBLIC_CANISTER_ID:evm_rpc");

    EvmRpcClient::builder(IcRuntime::new(), canister_id)
        .with_rpc_sources(RpcServices::EthMainnet(None))
        .with_consensus_strategy(ConsensusStrategy::Threshold {
            total: Some(3),
            min: 2,
        })
        .build()
}

// -- Get ETH balance via raw JSON-RPC --
// Returns hex-encoded wei (e.g., "0xde0b6b3a7640000" = 1 ETH).
// Parse hex to u128, divide by 10^18 to get ETH.

#[update]
async fn get_eth_balance(address: String) -> String {
    let json = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [address, "latest"],
        "id": 1
    });

    client()
        .multi_request(json)
        .send()
        .await
        .expect_consistent()
        .unwrap_or_else(|err| ic_cdk::trap(&format!("RPC error: {:?}", err)))
}

// -- Get latest block via typed API --

#[update]
async fn get_latest_block() -> Block {
    let result = client()
        .get_block_by_number(BlockTag::Latest)
        .send()
        .await;

    match result {
        MultiRpcResult::Consistent(Ok(block)) => block,
        MultiRpcResult::Consistent(Err(err)) => {
            ic_cdk::trap(&format!("RPC error: {:?}", err))
        }
        MultiRpcResult::Inconsistent(_) => {
            ic_cdk::trap("Providers returned inconsistent results")
        }
    }
}

// -- Read ERC-20 balance via eth_call --
// Returns hex-encoded uint256. Divide by 10^decimals (e.g., 6 for USDC, 18 for DAI).
// Function selector for balanceOf(address): 0x70a08231
// Pad address to 32 bytes (remove 0x prefix, left-pad with zeros)

#[update]
async fn get_erc20_balance(token_contract: String, wallet_address: String) -> String {
    let addr = wallet_address.trim_start_matches("0x");
    let calldata = format!("0x70a08231{:0>64}", addr);

    let args = CallArgs {
        transaction: evm_rpc_types::TransactionRequest {
            to: Some(Hex20::from_str(&token_contract).unwrap()),
            input: Some(Hex::from_str(&calldata).unwrap()),
            ..Default::default()
        },
        block: None,
    };

    let result = client()
        .call(args)
        .send()
        .await
        .expect_consistent()
        .unwrap_or_else(|err| ic_cdk::trap(&format!("eth_call error: {:?}", err)));

    result.to_string()
}

// -- Send a signed raw transaction --

#[update]
async fn send_raw_transaction(signed_tx_hex: String) -> SendRawTransactionStatus {
    client()
        .send_raw_transaction(Hex::from_str(&signed_tx_hex).unwrap())
        .send()
        .await
        .expect_consistent()
        .unwrap_or_else(|err| ic_cdk::trap(&format!("RPC error: {:?}", err)))
}

// -- Get transaction receipt --

#[update]
async fn get_transaction_receipt(tx_hash: String) -> evm_rpc_types::TransactionReceipt {
    client()
        .get_transaction_receipt(Hex32::from_str(&tx_hash).unwrap())
        .send()
        .await
        .expect_consistent()
        .unwrap_or_else(|err| ic_cdk::trap(&format!("RPC error: {:?}", err)))
        .unwrap_or_else(|| ic_cdk::trap("Transaction receipt not found"))
}

// -- Override chain per request (e.g., Arbitrum instead of the client default) --

#[update]
async fn get_arbitrum_block() -> Block {
    client()
        .get_block_by_number(BlockTag::Latest)
        .with_rpc_sources(RpcServices::ArbitrumOne(None))
        .send()
        .await
        .expect_consistent()
        .unwrap_or_else(|err| ic_cdk::trap(&format!("RPC error: {:?}", err)))
}

ic_cdk::export_candid!();
```

## Deploy & Test

```bash
# Local: deploys both backend and evm_rpc (as defined in the local environment)
icp network start -d
icp deploy -e local

# Mainnet: deploys only backend (evm_rpc is excluded from the ic environment)
icp deploy -e ic
```

### Test via icp CLI

```bash
# Set up variables
export CYCLES=10000000000

# Get ETH balance (raw JSON-RPC via single provider)
icp canister call evm_rpc request '(
  variant { EthMainnet = variant { PublicNode } },
  "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\",\"latest\"],\"id\":1}",
  1000
)' --with-cycles=$CYCLES

# Get latest block (typed API, multi-provider)
icp canister call evm_rpc eth_getBlockByNumber '(
  variant { EthMainnet = null },
  null,
  variant { Latest }
)' --with-cycles=$CYCLES

# Get transaction receipt
icp canister call evm_rpc eth_getTransactionReceipt '(
  variant { EthMainnet = null },
  null,
  "0xdd5d4b18923d7aae953c7996d791118102e889bea37b48a651157a4890e4746f"
)' --with-cycles=$CYCLES

# Check available providers
icp canister call evm_rpc getProviders

# Estimate cost before calling
icp canister call evm_rpc requestCost '(
  variant { EthMainnet = variant { PublicNode } },
  "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045\",\"latest\"],\"id\":1}",
  1000
)'
```