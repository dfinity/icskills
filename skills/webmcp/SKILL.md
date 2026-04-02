---
name: webmcp
description: "Expose Internet Computer canister methods as AI agent tools via WebMCP (Web Model Context Protocol). Covers Candid-to-JSON-Schema codegen, browser tool registration via navigator.modelContext, certified query verification, Internet Identity scoped delegation for agents, and framework adapters for OpenAI/Anthropic/LangChain. Use when building AI-accessible dapps, agent tooling, or canister discovery."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2"
metadata:
  title: WebMCP — AI Agent Tool Protocol
  category: Integration
---

# WebMCP for the Internet Computer

## What This Is

WebMCP (Web Model Context Protocol) is a W3C browser standard (Chrome 146+) that lets websites register callable tools for AI agents via `navigator.modelContext`. The Internet Computer is uniquely suited for WebMCP: Candid interfaces already define structured tool schemas, certified queries provide verifiable responses, and Internet Identity enables scoped agent authentication via delegation chains.

The IC WebMCP stack generates tool manifests from `.did` files, serves them from asset canisters, and bridges `navigator.modelContext` to canister calls via `@dfinity/agent`. A polyfill extends this to non-Chrome browsers and server-side agent frameworks (Claude, OpenAI, LangChain).

## Prerequisites

- Rust: `ic-webmcp-codegen` crate (CLI tool) for manifest generation
- TypeScript: `@dfinity/webmcp` package for browser/agent integration
- `@dfinity/agent` >= 1.0.0, `@dfinity/candid` >= 1.0.0, `@dfinity/principal` >= 1.0.0
- Chrome 146+ for native `navigator.modelContext` (polyfill available for other environments)

## Canister IDs

No fixed canister IDs. WebMCP is a protocol layer applied to YOUR canister. The manifest embeds your canister's principal ID.

## Mistakes That Break Your Build

1. **Not generating the manifest before deploying.** The `webmcp.json` must be generated from your `.did` file using `ic-webmcp-codegen` and placed in your asset canister's assets directory. Without it, no AI agent can discover your tools.

2. **Forgetting CORS headers on the manifest.** The `/.well-known/webmcp.json` endpoint must return `Access-Control-Allow-Origin: *` and `Content-Type: application/json`. Use `ic-webmcp-asset-middleware` or add an `.ic-assets.json5` config. Without CORS, cross-origin browser requests fail silently.

3. **Using `document.currentScript` in module scripts.** The generated `webmcp.js` is an ES module — `document.currentScript` is always `null` for module scripts. The codegen uses top-level `await` instead. If you write custom init code, don't rely on `document.currentScript`.

4. **Passing empty `targets` to `createScopedDelegation`.** An empty targets array produces an unrestricted delegation valid for ALL IC canisters, not just yours. Always pass at least your canister ID. Use `getDelegationTargets(canisterId, manifest.authentication)` to build the correct list.

5. **Omitting methods from `expose_methods` but listing them in other config sections.** If `expose_methods` is set in `dfx.json`, only those methods appear in the manifest. Methods listed in `require_auth`, `certified_queries`, or `descriptions` but NOT in `expose_methods` are silently dropped.

6. **Sending parameters without an IDL factory.** Without `setIdlFactory()`, the bridge can only call zero-argument methods. For methods with parameters, the bridge throws: `"requires an idlFactory to encode parameters"`. Always provide the generated IDL factory for full tool execution.

7. **Assuming `certified: true` means full BLS verification.** The `certified` flag in the manifest indicates the query supports certified responses. `@dfinity/agent` verifies node signatures automatically (`verifyQuerySignatures: true` by default), but this is node-level verification. For full BLS threshold certificate verification of canister-managed certified data, use `readCertifiedData()` with `readState()`.

8. **Loading `@dfinity/webmcp` from a CDN without integrity checking.** The generated `webmcp.js` imports `@dfinity/webmcp`. In production, this must come from your own bundled copy, not a third-party CDN. CDN imports without Subresource Integrity (SRI) are a supply chain attack vector.

9. **Not handling `onAuthRequired` for update methods.** Tools marked `requires_auth: true` will throw if the user is anonymous and no `onAuthRequired` callback is configured. Always provide an auth callback that triggers Internet Identity login.

10. **Ignoring recursive Candid types.** Types like `type Value = variant { Array: vec Value }` (common in ICRC-3) are handled by the codegen, which emits `{ "description": "Recursive type: Value" }` at the recursion point. Agents should treat these as opaque — they cannot be fully validated by JSON Schema alone.

## Pipeline Overview

```
dfx.json (with webmcp section)
  + backend.did
       │
       ▼
ic-webmcp-codegen dfx --dfx-json dfx.json --out-dir assets/
       │
       ├── backend.webmcp.json    →  /.well-known/webmcp.json
       └── backend.webmcp.js      →  /webmcp.js
       │
       ▼
Asset canister serves manifest + script with CORS headers
       │
       ▼
Browser loads webmcp.js → @dfinity/webmcp → navigator.modelContext
       │
       ▼
AI agent discovers tools → calls execute() → @dfinity/agent → canister
```

## Step 1: Add `webmcp` to dfx.json

```json
{
  "canisters": {
    "backend": {
      "type": "rust",
      "candid": "backend.did",
      "webmcp": {
        "enabled": true,
        "name": "My DApp",
        "description": "Description for AI agents",
        "expose_methods": ["get_items", "add_to_cart", "checkout"],
        "require_auth": ["add_to_cart", "checkout"],
        "certified_queries": ["get_items"],
        "descriptions": {
          "get_items": "List available products with prices",
          "add_to_cart": "Add a product to the shopping cart",
          "checkout": "Complete purchase with current cart contents"
        },
        "param_descriptions": {
          "add_to_cart.product_id": "The unique product identifier",
          "add_to_cart.quantity": "Number of items to add (default 1)"
        }
      }
    },
    "frontend": {
      "type": "assets",
      "source": ["assets"],
      "dependencies": ["backend"]
    }
  }
}
```

Config fields:
- `enabled` (bool, default true): whether to generate for this canister
- `name` (string): human-readable name shown to AI agents
- `description` (string): what the canister does, in agent-friendly terms
- `expose_methods` (string[]): which service methods to include. Omit to include all.
- `require_auth` (string[]): methods requiring Internet Identity authentication
- `certified_queries` (string[]): query methods with certified responses
- `descriptions` (object): per-method descriptions (key: method name)
- `param_descriptions` (object): per-parameter descriptions (key: `"method.param"`)

## Step 2: Generate the Manifest

```bash
# Install (from the IC repo)
cargo install --path rs/webmcp/codegen

# Generate from dfx.json (all WebMCP-enabled canisters)
ic-webmcp-codegen dfx --dfx-json dfx.json --out-dir assets/

# Or from a single .did file
ic-webmcp-codegen did \
  --did backend.did \
  --canister-id ryjl3-tyaaa-aaaaa-aaaba-cai \
  --name "My DApp" \
  --expose get_items,add_to_cart,checkout \
  --require-auth add_to_cart,checkout \
  --out-manifest assets/.well-known/webmcp.json \
  --out-js assets/webmcp.js
```

## Step 3: Configure CORS Headers

Add to `assets/.ic-assets.json5`:

```json5
[
  {
    "match": "/.well-known/webmcp.json",
    "headers": [
      { "name": "Content-Type", "value": "application/json" },
      { "name": "Access-Control-Allow-Origin", "value": "*" },
      { "name": "Access-Control-Allow-Methods", "value": "GET, OPTIONS" },
      { "name": "Access-Control-Allow-Headers", "value": "Content-Type" },
      { "name": "Cache-Control", "value": "public, max-age=300" }
    ],
    "allow_raw_access": true
  },
  {
    "match": "/webmcp.js",
    "headers": [
      { "name": "Content-Type", "value": "application/javascript; charset=utf-8" },
      { "name": "Access-Control-Allow-Origin", "value": "*" },
      { "name": "Cache-Control", "value": "public, max-age=300" }
    ],
    "allow_raw_access": true
  }
]
```

Or generate it programmatically:

```rust
use ic_webmcp_asset_middleware::ic_assets_config;
std::fs::write("assets/.ic-assets.json5", ic_assets_config()).unwrap();
```

## Step 4: Browser Integration

**Automatic (zero-code):** Include the generated script in your HTML:

```html
<script type="module" src="/webmcp.js"></script>
```

**Manual (with auth support):**

```typescript
import { ICWebMCP } from '@dfinity/webmcp';
import { AuthClient } from '@dfinity/auth-client';

const authClient = await AuthClient.create();

const webmcp = new ICWebMCP({
  manifestUrl: '/.well-known/webmcp.json',
  host: 'https://icp-api.io',
  onAuthRequired: async () => {
    await authClient.login({ identityProvider: 'https://identity.ic0.app' });
    return authClient.getIdentity();
  },
});

await webmcp.registerAll();
```

## Step 5: Non-Chrome / Server-Side Agent Integration

Use the polyfill to expose tools to any AI framework:

```typescript
import { ICWebMCP, installPolyfill, getOpenAITools, getAnthropicTools, dispatchToolCall } from '@dfinity/webmcp';

// Install shim (no-op if navigator.modelContext exists natively)
installPolyfill();

const webmcp = new ICWebMCP({ manifestUrl: '/.well-known/webmcp.json' });
await webmcp.registerAll();

// OpenAI function calling
const tools = getOpenAITools();
const completion = await openai.chat.completions.create({
  model: 'gpt-4o',
  tools,
  messages,
});

// Anthropic tool use
const anthropicTools = getAnthropicTools();
const message = await anthropic.messages.create({
  model: 'claude-sonnet-4-5-20241022',
  tools: anthropicTools,
  messages,
});

// Dispatch a tool call result back to the IC canister
const result = await dispatchToolCall('get_items', {});
```

## Step 6: Scoped Delegation for Agent Auth

Create short-lived, canister-scoped delegations for AI agents:

```typescript
import { ICWebMCP, createScopedDelegation, getDelegationTargets } from '@dfinity/webmcp';

const webmcp = new ICWebMCP({ identity: iiIdentity });
await webmcp.registerAll();

// 1-hour delegation scoped to this canister only
const agentIdentity = await webmcp.createAgentDelegation({
  maxTtlSeconds: 3600,
});

webmcp.setIdentity(agentIdentity);
```

## Candid → JSON Schema Type Mapping

| Candid Type | JSON Schema |
|---|---|
| `nat` | `{ "type": "string", "pattern": "^[0-9]+$" }` |
| `int` | `{ "type": "string", "pattern": "^-?[0-9]+$" }` |
| `nat8/16/32` | `{ "type": "integer", "minimum": 0, "maximum": N }` |
| `nat64` | `{ "type": "string", "pattern": "^[0-9]+$" }` |
| `text` | `{ "type": "string" }` |
| `bool` | `{ "type": "boolean" }` |
| `blob` | `{ "type": "string", "contentEncoding": "base64" }` |
| `principal` | `{ "type": "string" }` |
| `opt T` | `{ "oneOf": [schema(T), { "type": "null" }] }` |
| `vec T` | `{ "type": "array", "items": schema(T) }` |
| `record { a: T }` | `{ "type": "object", "properties": { "a": schema(T) } }` |
| `variant { A; B: T }` | `{ "oneOf": [{ "const": "A" }, { "type": "object", ... }] }` |

## Verification

```bash
# Check manifest is served correctly
curl -s https://<canister-id>.icp0.io/.well-known/webmcp.json | jq .schema_version
# Expected: "1.0"

# Check CORS headers
curl -sI https://<canister-id>.icp0.io/.well-known/webmcp.json | grep -i access-control
# Expected: Access-Control-Allow-Origin: *

# Generate and verify manifest from .did file
ic-webmcp-codegen did --did backend.did --no-js --out-manifest /dev/stdout | jq '.tools | length'
# Expected: number of exposed methods

# Run codegen tests
cargo test -p ic-webmcp-codegen

# Run TypeScript tests
cd packages/ic-webmcp && npm test
```
