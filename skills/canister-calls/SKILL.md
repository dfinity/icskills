---
name: canister-calls
description: "Generate typed bindings from a Candid interface and call a canister from JavaScript/TypeScript, Rust, or Motoko. Covers Candid ↔ JS/TS type mapping (nat as BigInt, opt as T | null, variant as object not string), binding generation with @icp-sdk/bindgen or ic-cdk-bindgen, and actor/client initialization. Use when you have a canister ID or .did file and need to call it from frontend or canister code, or when handling Candid types in TypeScript. Do NOT use for token transfer workflows — use icrc-ledger instead. Do NOT use for ckBTC — use ckbtc instead. Do NOT use for EVM JSON-RPC — use evm-rpc instead. Do NOT use for inter-canister call patterns and error handling — use multi-canister instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2, Node.js >= 22"
metadata:
  title: Canister Calls & Bindings
  category: Integration
---

# Canister Calls & Bindings

## What This Is

Every canister on the Internet Computer exposes a Candid interface — a typed API description embedded in the WASM module. This skill covers how to fetch that interface, generate typed bindings for your language, and call the canister from JavaScript/TypeScript, Rust, or Motoko.

## Prerequisites

- **JavaScript/TypeScript**: `@icp-sdk/core` (>= 5.0.0), `@icp-sdk/bindgen` (>= 0.3.0)
- **Rust**: `ic-cdk` (>= 0.19), `candid` (>= 0.10), `ic-cdk-bindgen` (build-time, optional)
- **CLI**: `icp-cli` (>= 0.2.2)

## Fetching the Candid Interface

```bash
# Fetch from mainnet and save to a .did file
icp canister metadata <CANISTER_ID> candid:service -e ic > mycanister.did

# Fetch from local replica
icp canister metadata <CANISTER_ID> candid:service > mycanister.did
```

This returns the full Candid service definition: method names, argument and return types, and whether each method is `query` or `update`.

## Reading a Candid Interface

```candid
service : {
  // update — goes through consensus, can mutate state (~2s)
  submit : (OrderRequest) -> (variant { Ok : OrderId; Err : Text });

  // query — fast read-only, does not go through consensus (~200ms)
  get_order : (OrderId) -> (opt Order) query;

  // vec = array, nat = BigInt in JS
  list_orders : () -> (vec Order) query;
}
```

All referenced types (`OrderRequest`, `Order`, etc.) are defined earlier in the same `.did` file.

## Candid ↔ JavaScript/TypeScript Type Mapping

Agents with `@dfinity/agent` background frequently get these wrong:

| Candid type | JS/TS type (bindgen wrapper) | Common mistake |
|-------------|------------------------------|----------------|
| `nat`, `nat64` | `BigInt` | Using `number` — silent overflow for large values |
| `nat32`, `nat16`, `nat8` | `number` | Fine as `number` |
| `opt T` | `T \| null` | Using `[] \| [T]` — raw Candid encoding; bindgen wrapper converts to `T \| null` |
| `variant { Ok : T; Err : E }` | `{ Ok: T } \| { Err: E }` | Checking `result === 'Ok'` — variants are objects, not strings |
| `record { field : T }` | `{ field: T }` | — |
| `vec T` | `Array<T>` | — |
| `principal` | `Principal` | Passing as string — use `Principal.fromText()` |
| `blob` | `Uint8Array` | — |

### Variant handling

```typescript
const result = await actor.submit(request);

// Wrong — variants are objects, not strings
if (result === "Ok") { ... }

// Correct — check for the key
if ("Ok" in result) {
  console.log("Order ID:", result.Ok);
} else {
  console.error("Error:", result.Err);
}
```

### opt T handling

```typescript
const order = await actor.get_order(orderId);

// Wrong — raw Candid array style (@dfinity/agent legacy)
if (order.length > 0) { const o = order[0]; }

// Correct — bindgen wrapper converts opt T to T | null
if (order !== null) {
  console.log(order.status);
}
```

## Generating Typed Bindings

### JavaScript / TypeScript — Vite plugin (recommended)

```js
// vite.config.js
import { icpBindgen } from "@icp-sdk/bindgen/plugins/vite";

export default defineConfig({
  plugins: [
    icpBindgen({
      didFile: "../backend/backend.did",
      outDir: "./src/bindings",
    }),
  ],
});
```

Each `icpBindgen()` generates a `<name>.ts` file in `outDir` with a `createActor` function. The `.did` file must be committed to the repo — see the **icp-cli** skill for how to configure `candid:` in the recipe so the `.did` is generated at build time.

### JavaScript / TypeScript — CLI (non-Vite)

```bash
npx @icp-sdk/bindgen --did ./mycanister.did --out ./src/bindings
```

### Rust

Use `ic-cdk-bindgen` in `build.rs` to generate Rust types from `.did` files at build time. See https://crates.io/crates/ic-cdk-bindgen for setup.

## Initializing a Client

### JavaScript / TypeScript

```typescript
import { createActor } from "./bindings/backend";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

const canisterEnv = safeGetCanisterEnv();

// Unauthenticated actor
const actor = createActor(canisterId, {
  agentOptions: {
    host: window.location.origin,
    rootKey: canisterEnv?.IC_ROOT_KEY,
  },
});

// Authenticated actor (after Internet Identity login)
const authedActor = createActor(canisterId, {
  agentOptions: {
    identity, // from authClient.getIdentity()
    host: window.location.origin,
    rootKey: canisterEnv?.IC_ROOT_KEY,
  },
});
```

**Pitfall:** passing `{ agent }` instead of `{ agentOptions }`. The `createActor` generated by `@icp-sdk/bindgen` takes `{ agentOptions }` and creates the agent internally. Passing `{ agent }` silently falls back to an anonymous identity — calls return empty data or access denied with no error.

### Rust — Inter-Canister Call (ic-cdk >= 0.19)

```rust
use ic_cdk::call::Call;
use candid::Principal;

let canister_id = Principal::from_text("aaaaa-bbbbb-ccccc-ddddd-cai").unwrap();

// unbounded_wait: no timeout, always gets a response or rejection
let (result,): (String,) = Call::unbounded_wait(canister_id, "get_greeting")
    .with_arg("world")
    .await
    .expect("call failed")
    .candid_tuple()
    .expect("decode failed");

// bounded_wait: completes when the called canister responds or times out
let (result,): (String,) = Call::bounded_wait(canister_id, "get_greeting")
    .with_arg("world")
    .await
    .expect("call failed or timed out")
    .candid_tuple()
    .expect("decode failed");
```

**Pitfall:** `ic_cdk::call()` and `Call::new()` do not exist in ic-cdk >= 0.19. Use `Call::unbounded_wait` or `Call::bounded_wait`.

### Motoko — Dynamic Actor Reference

```motoko
// Type the remote interface inline — no .did file needed at compile time
transient let remote = actor ("aaaaa-bbbbb-ccccc-ddddd-cai") : actor {
  get_greeting : shared query (Text) -> async Text;
  submit : shared (OrderRequest) -> async { #Ok : OrderId; #Err : Text };
};

let greeting = await remote.get_greeting("world");
```

## Calling via CLI

```bash
# Update call
icp canister call <CANISTER_ID> <METHOD> '(<CANDID_ARGS>)' -e ic

# Query call (faster)
icp canister call <CANISTER_ID> <METHOD> '(<CANDID_ARGS>)' --query -e ic
```
