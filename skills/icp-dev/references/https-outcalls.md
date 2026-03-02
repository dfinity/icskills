# HTTPS Outcalls

HTTPS outcalls allow canisters to make HTTP requests to external web services directly from on-chain code. A transform function strips non-deterministic fields so that every replica sees an identical response and can reach consensus.

## Canister IDs

| Name | Canister ID | Used For |
|------|-------------|----------|
| Management canister | `aaaaa-aa` | The `http_request` management call target |

## Mistakes That Break Your Build

1. **Forgetting the transform function.** Without a transform, the raw HTTP response often differs between replicas (different headers, different ordering in JSON fields, timestamps). Consensus fails and the call is rejected. ALWAYS provide a transform function.

2. **Not attaching cycles to the call.** HTTPS outcalls are not free. The calling canister must attach cycles to cover the cost. If you attach zero cycles, the call fails immediately. Cost is approximately 49_140_000 + 5_200 * response_bytes + 10_400 * request_bytes cycles. A safe default for most API calls is 200_000_000 (200M) cycles.

3. **Using HTTP instead of HTTPS.** The IC only supports HTTPS outcalls. Plain HTTP URLs are rejected. The target server must have a valid TLS certificate.

4. **Exceeding the 2MB response limit.** The maximum response body is 2MB (2_097_152 bytes). If the external API returns more, the call fails. Use the `max_response_bytes` field to set a limit and design your queries to return small responses.

5. **Non-idempotent POST requests without caution.** Because multiple replicas make the same request, a POST endpoint that is not idempotent (e.g., "create order") will be called N times (once per replica, typically 13 on a 13-node subnet). Use idempotency keys or design endpoints to handle duplicate requests.

6. **Not handling outcall failures.** External servers can be down, slow, or return errors. Always handle the error case. On the IC, if the external server does not respond within the timeout (~30 seconds), the call traps.

7. **Calling localhost or private IPs.** HTTPS outcalls can only reach public internet endpoints. Localhost, 10.x.x.x, 192.168.x.x, and other private ranges are blocked.

8. **Forgetting the `Host` header.** Some API endpoints require the `Host` header to be explicitly set. The IC does not automatically set this from the URL.

## Key Patterns

### Motoko

```motoko
import Blob "mo:core/Blob";
import Nat64 "mo:core/Nat64";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";

persistent actor {

  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?[Nat8];
    method : HttpMethod;
    transform : ?TransformRawResponseFunction;
  };

  type HttpHeader = { name : Text; value : Text };
  type HttpMethod = { #get; #post; #head };
  type HttpResponsePayload = { status : Nat; headers : [HttpHeader]; body : [Nat8] };
  type TransformRawResponseFunction = { function : shared query TransformArgs -> async HttpResponsePayload; context : Blob };
  type TransformArgs = { response : HttpResponsePayload; context : Blob };

  transient let ic : actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  } = actor "aaaaa-aa";

  // Transform: strips headers for consensus. MUST be `shared query`.
  public query func transform(args : TransformArgs) : async HttpResponsePayload {
    { status = args.response.status; body = args.response.body; headers = [] };
  };

  // GET request example
  public func fetchPrice() : async Text {
    let request : HttpRequestArgs = {
      url = "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";
      max_response_bytes = ?Nat64.fromNat(10_000);
      headers = [{ name = "User-Agent"; value = "ic-canister" }];
      body = null;
      method = #get;
      transform = ?{ function = transform; context = "" : Blob };
    };

    // Attach cycles via `await (with cycles = N)` — the only way in mo:core 2.0
    let response = await (with cycles = 200_000_000) ic.http_request(request);

    let bodyBlob = Blob.fromArray(response.body);
    switch (Text.decodeUtf8(bodyBlob)) {
      case (?text) { text };
      case (null) { Runtime.trap("Response is not valid UTF-8") };
    };
  };
};
```

### Rust

```rust
use ic_cdk::api::canister_self;
use ic_cdk::management_canister::{
    http_request, HttpHeader, HttpMethod, HttpRequestArgs, HttpRequestResult,
    TransformArgs, TransformContext, TransformFunc,
};
use ic_cdk::{query, update};

/// Transform: strips headers for consensus. MUST be #[query].
#[query]
fn transform(args: TransformArgs) -> HttpRequestResult {
    HttpRequestResult {
        status: args.response.status,
        body: args.response.body,
        headers: vec![],
    }
}

/// GET request example
#[update]
async fn fetch_price() -> String {
    let request = HttpRequestArgs {
        url: "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd".to_string(),
        max_response_bytes: Some(10_000),
        method: HttpMethod::GET,
        headers: vec![HttpHeader { name: "User-Agent".to_string(), value: "ic-canister".to_string() }],
        body: None,
        transform: Some(TransformContext {
            function: TransformFunc::new(canister_self(), "transform".to_string()),
            context: vec![],
        }),
        is_replicated: None,
    };

    // ic-cdk 0.19 automatically computes and attaches the required cycles
    match http_request(&request).await {
        Ok(response) => String::from_utf8(response.body)
            .unwrap_or_else(|_| "Invalid UTF-8 in response".to_string()),
        Err(err) => format!("HTTP outcall failed: {:?}", err),
    }
}
```
