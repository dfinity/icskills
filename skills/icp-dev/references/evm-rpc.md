# EVM RPC Canister — Calling Ethereum from IC

The EVM RPC canister is an IC system canister that proxies JSON-RPC calls to Ethereum and EVM-compatible chains via HTTPS outcalls. Your canister sends a request to the EVM RPC canister, which fans it out to multiple RPC providers, compares responses for consensus, and returns the result. No API keys required for default providers.

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

## Mistakes That Break Your Build

1. **Not sending enough cycles.** Every EVM RPC call requires cycles attached. If you send too few, the call fails silently or traps. Start with 10B cycles and adjust down after verifying.

2. **Ignoring the `Inconsistent` result variant.** Multi-provider calls return `#Consistent(result)` or `#Inconsistent(results)`. If providers disagree, you get `Inconsistent`. Always handle both arms or your canister traps on provider disagreement.

3. **Using wrong chain variant.** `#EthMainnet` is for Ethereum L1. For Arbitrum use `#ArbitrumOne`, for Base use `#BaseMainnet`. Using the wrong variant queries the wrong chain.

4. **Forgetting `null` for optional config.** The second argument to every RPC method is an optional config record. Pass `null` for defaults. Omitting it causes a Candid type mismatch.

5. **Response size limits.** Large responses (e.g., `eth_getLogs` with broad filters) can exceed the max response size. Set `max_response_bytes` appropriately or the call fails.

6. **Calling `eth_sendRawTransaction` without signing first.** The EVM RPC canister does not sign transactions. You must sign the transaction yourself (using threshold ECDSA via the IC management canister) and pass the raw signed bytes.

7. **Using `Cycles.add` instead of `await (with cycles = ...)` in mo:core.** In mo:core 2.0, `Cycles.add` does not exist. Attach cycles using `await (with cycles = AMOUNT) canister.method(args)`. This is the only way to attach cycles in mo:core.

## icp.yaml Configuration

```yaml
canisters:
  evm_rpc:
    type: pull
    id: 7hfb6-caaaa-aaaar-qadga-cai
  backend:
    type: motoko  # or rust
    main: src/backend/main.mo
    dependencies:
      - evm_rpc
```

```bash
icp deps pull
icp deps init evm_rpc --argument '(record {})'
icp deps deploy
```

## Key Patterns

### Motoko

```motoko
import EvmRpc "canister:evm_rpc";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";

persistent actor {

  // Get ETH balance via raw JSON-RPC
  public func getEthBalance(address : Text) : async Text {
    let json = "{\"jsonrpc\":\"2.0\",\"method\":\"eth_getBalance\",\"params\":[\"" # address # "\",\"latest\"],\"id\":1}";
    let maxResponseBytes : Nat64 = 1000;

    let cyclesResult = await EvmRpc.requestCost(#EthMainnet(#PublicNode), json, maxResponseBytes);
    let cost = switch (cyclesResult) {
      case (#Ok(c)) { c };
      case (#Err(err)) { Runtime.trap("requestCost failed: " # debug_show err) };
    };

    let result = await (with cycles = cost) EvmRpc.request(
      #EthMainnet(#PublicNode), json, maxResponseBytes
    );

    switch (result) {
      case (#Ok(response)) { response };
      case (#Err(err)) { Runtime.trap("RPC error: " # debug_show err) };
    }
  };

  // Get latest block via typed API (multi-provider consensus)
  public func getLatestBlock() : async ?EvmRpc.Block {
    let result = await (with cycles = 10_000_000_000) EvmRpc.eth_getBlockByNumber(
      #EthMainnet(null), null, #Latest
    );

    switch (result) {
      case (#Consistent(#Ok(block))) { ?block };
      case (#Consistent(#Err(error))) { Runtime.trap("Error: " # debug_show error) };
      case (#Inconsistent(_results)) { Runtime.trap("Providers returned inconsistent results") };
    }
  };
};
```

### Rust

```rust
use candid::{CandidType, Deserialize, Principal};
use ic_cdk::call::Call;
use ic_cdk::update;

const EVM_RPC_CANISTER: &str = "7hfb6-caaaa-aaaar-qadga-cai";

fn evm_rpc_id() -> Principal {
    Principal::from_text(EVM_RPC_CANISTER).unwrap()
}

// Minimal type definitions — see full EVM RPC Candid interface for all variants
#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcService {
    EthMainnet(EthMainnetService),
    EthSepolia(EthSepoliaService),
    ArbitrumOne(L2MainnetService),
    BaseMainnet(L2MainnetService),
    OptimismMainnet(L2MainnetService),
    Custom(CustomRpcService),
    Provider(u64),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcServices {
    EthMainnet(Option<Vec<EthMainnetService>>),
    EthSepolia(Option<Vec<EthSepoliaService>>),
    ArbitrumOne(Option<Vec<L2MainnetService>>),
    BaseMainnet(Option<Vec<L2MainnetService>>),
    OptimismMainnet(Option<Vec<L2MainnetService>>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum EthMainnetService { Alchemy, Ankr, BlockPi, Cloudflare, Llama, PublicNode }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum EthSepoliaService { Alchemy, Ankr, BlockPi, PublicNode, Sepolia }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum L2MainnetService { Alchemy, Ankr, BlockPi, Llama, PublicNode }

#[derive(CandidType, Deserialize, Clone, Debug)]
struct CustomRpcService { url: String, headers: Option<Vec<HttpHeader>> }

#[derive(CandidType, Deserialize, Clone, Debug)]
struct HttpHeader { name: String, value: String }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum BlockTag { Latest, Safe, Finalized, Earliest, Pending, Number(candid::Nat) }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum MultiResult<T> {
    Consistent(RpcResult<T>),
    Inconsistent(Vec<(RpcService, RpcResult<T>)>),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcResult<T> { Ok(T), Err(RpcError) }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RpcError {
    ProviderError(ProviderError),
    HttpOutcallError(HttpOutcallError),
    JsonRpcError(JsonRpcError),
    ValidationError(ValidationError),
}

#[derive(CandidType, Deserialize, Clone, Debug)]
enum ProviderError { TooFewCycles { expected: candid::Nat, received: candid::Nat }, MissingRequiredProvider, ProviderNotFound, NoPermission, InvalidRpcConfig(String) }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum RejectionCode { NoError, CanisterError, SysTransient, DestinationInvalid, Unknown, SysFatal, CanisterReject }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum HttpOutcallError {
    IcError { code: RejectionCode, message: String },
    InvalidHttpJsonRpcResponse { status: u16, body: String, #[serde(rename = "parsingError")] parsing_error: Option<String> },
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct JsonRpcError { code: i64, message: String }

#[derive(CandidType, Deserialize, Clone, Debug)]
enum ValidationError { Custom(String), InvalidHex(String) }

// -- Get ETH balance via raw JSON-RPC --

#[update]
async fn get_eth_balance(address: String) -> String {
    let json = format!(
        r#"{{"jsonrpc":"2.0","method":"eth_getBalance","params":["{}","latest"],"id":1}}"#,
        address
    );

    let (result,): (Result<String, RpcError>,) = Call::unbounded_wait(evm_rpc_id(), "request")
        .with_args(&(
            RpcService::EthMainnet(EthMainnetService::PublicNode),
            json,
            1000_u64,
        ))
        .with_cycles(10_000_000_000_u128)
        .await
        .expect("Failed to call EVM RPC canister")
        .candid_tuple()
        .expect("Failed to decode response");

    match result {
        Ok(response) => response,
        Err(err) => ic_cdk::trap(&format!("RPC error: {:?}", err)),
    }
}
```
