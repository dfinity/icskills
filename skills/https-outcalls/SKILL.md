---
id: https-outcalls
name: HTTPS Outcalls
category: Integration
description: "Make HTTP requests from canisters to external APIs. Consensus-safe request patterns, transform functions, and cost management."
endpoints: 4
version: 1.5.0
status: stable
dependencies: []
---

# HTTPS Outcalls
> version: 1.5.0 | requires: [icp-cli >= 0.1.0]

## What This Is

HTTPS outcalls allow canisters to make HTTP requests to external web services directly from on-chain code. Because the Internet Computer runs on a replicated subnet (multiple nodes execute the same code), all nodes must agree on the response. A transform function strips non-deterministic fields (timestamps, request IDs, ordering) so that every replica sees an identical response and can reach consensus.

## Prerequisites

- icp-cli >= 0.1.0 (`brew install dfinity/tap/icp-cli`)
- For Motoko: `moc` compiler (included with icp-cli), `mo:core` 2.0 in mops.toml
- For Rust: `ic-cdk >= 0.18`, `serde_json` for JSON parsing

## Canister IDs

HTTPS outcalls use the IC management canister:

| Name | Canister ID | Used For |
|------|-------------|----------|
| Management canister | `aaaaa-aa` | The `http_request` management call target |

You do not deploy anything extra. The management canister is built into every subnet.

## Mistakes That Break Your Build

1. **Forgetting the transform function.** Without a transform, the raw HTTP response often differs between replicas (different headers, different ordering in JSON fields, timestamps). Consensus fails and the call is rejected. ALWAYS provide a transform function.

2. **Not attaching cycles to the call.** HTTPS outcalls are not free. The calling canister must attach cycles to cover the cost. If you attach zero cycles, the call fails immediately. Cost is approximately 49_140_000 + 5_200 * response_bytes + 10_400 * request_bytes cycles. A safe default for most API calls is 200_000_000 (200M) cycles.

3. **Using HTTP instead of HTTPS.** The IC only supports HTTPS outcalls. Plain HTTP URLs are rejected. The target server must have a valid TLS certificate.

4. **Exceeding the 2MB response limit.** The maximum response body is 2MB (2_097_152 bytes). If the external API returns more, the call fails. Use the `max_response_bytes` field to set a limit and design your queries to return small responses.

5. **Non-idempotent POST requests without caution.** Because multiple replicas make the same request, a POST endpoint that is not idempotent (e.g., "create order") will be called N times (once per replica, typically 13 on a 13-node subnet). Use idempotency keys or design endpoints to handle duplicate requests.

6. **Not handling outcall failures.** External servers can be down, slow, or return errors. Always handle the error case. On the IC, if the external server does not respond within the timeout (~30 seconds), the call traps.

7. **Calling localhost or private IPs.** HTTPS outcalls can only reach public internet endpoints. Localhost, 10.x.x.x, 192.168.x.x, and other private ranges are blocked.

8. **Forgetting the `Host` header.** Some API endpoints require the `Host` header to be explicitly set. The IC does not automatically set this from the URL.

## Implementation

### Motoko

```motoko
import Blob "mo:core/Blob";
import Nat64 "mo:core/Nat64";
import Text "mo:core/Text";
import Runtime "mo:core/Runtime";

persistent actor {

  // Type definitions for the management canister HTTP interface
  type HttpRequestArgs = {
    url : Text;
    max_response_bytes : ?Nat64;
    headers : [HttpHeader];
    body : ?[Nat8];
    method : HttpMethod;
    transform : ?TransformRawResponseFunction;
  };

  type HttpHeader = {
    name : Text;
    value : Text;
  };

  type HttpMethod = {
    #get;
    #post;
    #head;
  };

  type HttpResponsePayload = {
    status : Nat;
    headers : [HttpHeader];
    body : [Nat8];
  };

  type TransformRawResponseFunction = {
    function : shared query TransformArgs -> async HttpResponsePayload;
    context : Blob;
  };

  type TransformArgs = {
    response : HttpResponsePayload;
    context : Blob;
  };

  // The management canister for making outcalls
  transient let ic : actor {
    http_request : HttpRequestArgs -> async HttpResponsePayload;
  } = actor "aaaaa-aa";

  // Transform function: strips headers and keeps only the body.
  // This ensures all replicas see the same response for consensus.
  // MUST be a `shared query` function.
  public query func transform(args : TransformArgs) : async HttpResponsePayload {
    {
      status = args.response.status;
      body = args.response.body;
      headers = []; // Strip headers -- they often contain non-deterministic values
    };
  };

  // GET request: fetch a JSON API
  public func fetchPrice() : async Text {
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";

    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(10_000); // Limit response size
      headers = [
        { name = "User-Agent"; value = "ic-canister" },
      ];
      body = null;
      method = #get;
      transform = ?{
        function = transform;
        context = Blob.empty();
      };
    };

    // Attach cycles for the outcall (200M is safe for most requests)
    // In mo:core, use `await (with cycles = N)` instead of the old Cycles.add<system>(N)
    let response = await (with cycles = 200_000_000) ic.http_request(request);

    // Decode the response body
    let bodyBlob = Blob.fromArray(response.body);
    let body = Text.decodeUtf8(bodyBlob);
    switch (body) {
      case (?text) { text };
      case (null) { Runtime.trap("Response is not valid UTF-8") };
    };
  };

  // POST request: send JSON data
  public func postData(jsonPayload : Text) : async Text {
    let url = "https://httpbin.org/post";

    let bodyBytes = Blob.toArray(Text.encodeUtf8(jsonPayload));

    let request : HttpRequestArgs = {
      url = url;
      max_response_bytes = ?Nat64.fromNat(50_000);
      headers = [
        { name = "Content-Type"; value = "application/json" },
        { name = "User-Agent"; value = "ic-canister" },
        // Idempotency key: prevents duplicate processing if multiple replicas hit the endpoint
        { name = "Idempotency-Key"; value = "unique-request-id-12345" },
      ];
      body = ?bodyBytes;
      method = #post;
      transform = ?{
        function = transform;
        context = Blob.empty();
      };
    };

    // POST may cost more due to request body size
    let response = await (with cycles = 300_000_000) ic.http_request(request);

    let bodyBlob = Blob.fromArray(response.body);
    let body = Text.decodeUtf8(bodyBlob);
    switch (body) {
      case (?text) { text };
      case (null) { Runtime.trap("Response is not valid UTF-8") };
    };
  };
};
```

### Rust

```toml
# Cargo.toml
[package]
name = "https_outcalls_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.18"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

```rust
use ic_cdk::api::management_canister::http_request::{
    http_request, CanisterHttpRequestArgument, HttpHeader, HttpMethod, HttpResponse,
    TransformArgs, TransformContext, TransformFunc,
};
use ic_cdk::{query, update};
use serde::Deserialize;

/// Transform function: strips non-deterministic headers so all replicas agree.
/// MUST be a #[query] function.
#[query]
fn transform(args: TransformArgs) -> HttpResponse {
    HttpResponse {
        status: args.response.status,
        body: args.response.body,
        headers: vec![], // Strip all headers for consensus
        // If you need specific headers, filter them here:
        // headers: args.response.headers.into_iter()
        //     .filter(|h| h.name.to_lowercase() == "content-type")
        //     .collect(),
    }
}

/// GET request: Fetch JSON from an external API
#[update]
async fn fetch_price() -> String {
    let url = "https://api.coingecko.com/api/v3/simple/price?ids=internet-computer&vs_currencies=usd";

    let request = CanisterHttpRequestArgument {
        url: url.to_string(),
        max_response_bytes: Some(10_000),
        method: HttpMethod::GET,
        headers: vec![
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "ic-canister".to_string(),
            },
        ],
        body: None,
        transform: Some(TransformContext {
            function: TransformFunc(candid::Func {
                principal: ic_cdk::id(),
                method: "transform".to_string(),
            }),
            context: vec![],
        }),
    };

    // Attach 200M cycles for the outcall
    let cycles: u128 = 200_000_000;

    match http_request(request, cycles).await {
        Ok((response,)) => {
            let body = String::from_utf8(response.body)
                .unwrap_or_else(|_| "Invalid UTF-8 in response".to_string());

            if response.status != candid::Nat::from(200u64) {
                return format!("HTTP error: status {}", response.status);
            }

            body
        }
        Err((code, msg)) => {
            format!("HTTP outcall failed: {:?} - {}", code, msg)
        }
    }
}

/// Typed response parsing example
#[derive(Deserialize)]
struct PriceResponse {
    #[serde(rename = "internet-computer")]
    internet_computer: PriceData,
}

#[derive(Deserialize)]
struct PriceData {
    usd: f64,
}

#[update]
async fn get_icp_price_usd() -> String {
    let body = fetch_price().await;

    match serde_json::from_str::<PriceResponse>(&body) {
        Ok(parsed) => format!("ICP price: ${:.2}", parsed.internet_computer.usd),
        Err(e) => format!("Failed to parse price response: {}", e),
    }
}

/// POST request: Send JSON data to an external API
#[update]
async fn post_data(json_payload: String) -> String {
    let url = "https://httpbin.org/post";

    let request = CanisterHttpRequestArgument {
        url: url.to_string(),
        max_response_bytes: Some(50_000),
        method: HttpMethod::POST,
        headers: vec![
            HttpHeader {
                name: "Content-Type".to_string(),
                value: "application/json".to_string(),
            },
            HttpHeader {
                name: "User-Agent".to_string(),
                value: "ic-canister".to_string(),
            },
            // Idempotency key: prevents duplicate processing across replicas
            HttpHeader {
                name: "Idempotency-Key".to_string(),
                value: "unique-request-id-12345".to_string(),
            },
        ],
        body: Some(json_payload.into_bytes()),
        transform: Some(TransformContext {
            function: TransformFunc(candid::Func {
                principal: ic_cdk::id(),
                method: "transform".to_string(),
            }),
            context: vec![],
        }),
    };

    let cycles: u128 = 300_000_000;

    match http_request(request, cycles).await {
        Ok((response,)) => {
            String::from_utf8(response.body)
                .unwrap_or_else(|_| "Invalid UTF-8 in response".to_string())
        }
        Err((code, msg)) => {
            format!("HTTP outcall failed: {:?} - {}", code, msg)
        }
    }
}
```

### Cycle Cost Estimation

```
Base cost:                      49_140_000 cycles
+ per request byte:             10_400 cycles
+ per response byte:            5_200 cycles
+ per request header:           variable

Example: GET request, 5KB response
  49_140_000 + (0 * 10_400) + (5_120 * 5_200) = ~75_764_000 cycles
  Safe budget: 200_000_000 (200M)

Example: POST request, 1KB body, 10KB response
  49_140_000 + (1_024 * 10_400) + (10_240 * 5_200) = ~112_977_600 cycles
  Safe budget: 300_000_000 (300M)
```

Always over-budget. Unused cycles are refunded to the canister.

## Deploy & Test

### Local Deployment

```bash
# Start the local replica
icp network start -d

# Deploy your canister
icp deploy backend
```

Note: HTTPS outcalls work on the local replica. icp-cli proxies the requests through the local HTTP gateway.

### Mainnet Deployment

```bash
# Ensure your canister has enough cycles (check balance first)
icp canister status backend -e ic

# Deploy
icp deploy -e ic backend
```

## Verify It Works

```bash
# 1. Test the GET outcall (fetch price)
icp canister call backend fetchPrice
# Expected: Something like '("{\"internet-computer\":{\"usd\":12.34}}")'
# (actual price will vary)

# 2. Test the POST outcall
icp canister call backend postData '("{\"test\": \"hello\"}")'
# Expected: JSON response from httpbin.org echoing back your data

# 3. If using Rust with the typed parser:
icp canister call backend get_icp_price_usd
# Expected: '("ICP price: $12.34")'

# 4. Check canister cycle balance (outcalls consume cycles)
icp canister status backend
# Verify the balance decreased slightly after outcalls

# 5. Test error handling: call with an unreachable URL
# Add a test function that calls a non-existent domain and verify
# it returns an error message rather than trapping
```

### Debugging Outcall Failures

If an outcall fails:

```bash
# Check the replica log for detailed error messages
# Local: icp output shows errors inline
# Mainnet: check the canister logs

# Common errors:
# "Timeout" -- external server took too long (>30s)
# "No consensus" -- transform function is missing or not stripping enough
# "Body size exceeds limit" -- response > max_response_bytes
# "Not enough cycles" -- attach more cycles to the call
```

### Transform Debugging

If you get "no consensus could be reached" errors, your transform function is not making responses identical. Common culprits:

1. **Response headers differ** -- strip ALL headers in the transform
2. **JSON field ordering differs** -- parse and re-serialize the JSON in the transform
3. **Timestamps in response body** -- extract only the fields you need

Advanced transform that normalizes JSON:

```rust
#[query]
fn transform_normalize(args: TransformArgs) -> HttpResponse {
    // Parse and re-serialize to normalize field ordering
    let body = if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&args.response.body) {
        serde_json::to_vec(&json).unwrap_or(args.response.body)
    } else {
        args.response.body
    };

    HttpResponse {
        status: args.response.status,
        body,
        headers: vec![],
    }
}
```
