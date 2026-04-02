---
name: internet-identity
description: "Integrate Internet Identity authentication. Covers passkey and OpenID login flows, delegation handling, and principal-per-app isolation. Use when adding login, sign-in, auth, passkeys, or Internet Identity to a frontend or canister. Do NOT use for wallet integration or ICRC signer flows — use wallet-integration instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2, Node.js >= 22"
metadata:
  title: Internet Identity Auth
  category: Auth
---

# Internet Identity Authentication

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate into II-powered apps either with passkeys stored in their devices or thorugh OpenID accounts (e.g., Google, Apple, Microsoft) -- no login or passwords required. Each user gets a unique principal per app, preventing cross-app tracking.

## Prerequisites

- `@icp-sdk/auth` (>= 5.0.0), `@icp-sdk/core` (>= 5.0.0)

## Canister IDs

| Canister | ID | URL | Purpose |
|----------|------------|-----|---------|
| Internet Identity (backend) | `rdmx6-jaaaa-aaaaa-aaadq-cai` |  | Manages user keys and authentication logic |
| Internet Identity (frontend) | `uqzsh-gqaaa-aaaaq-qaada-cai` | `https://id.ai` | Serves the II web app; identity provider URL points here |

## Mistakes That Break Your Build

1. **Using the wrong II URL for the environment.** The identity provider URL must point to the **frontend** canister (`uqzsh-gqaaa-aaaaq-qaada-cai`), not the backend. Local development should use `http://id.ai.localhost:8000`. Mainnet must use `https://id.ai` (which resolves to the frontend canister). Both canister IDs are well-known and identical on mainnet and local replicas -- hardcode them rather than doing a dynamic lookup.

2. **Setting delegation expiry too long.** Maximum delegation expiry is 30 days (2_592_000_000_000_000 nanoseconds). Longer values are silently clamped, which causes confusing session behavior. Use 8 hours for normal apps, 30 days maximum for "remember me" flows.

3. **Not handling auth callbacks.** The `authClient.login()` call requires `onSuccess` and `onError` callbacks. Without them, login failures are silently swallowed.

4. **Using `shouldFetchRootKey` or `fetchRootKey()` instead of the `ic_env` cookie.** The `ic_env` cookie (set by the asset canister or the Vite dev server) already contains the root key as `IC_ROOT_KEY`. Pass it via the `rootKey` option to `HttpAgent.create()` — this works in both local and production environments without environment branching. See the icp-cli skill's `references/binding-generation.md` for the pattern. Never call `fetchRootKey()` — it fetches the root key from the replica at runtime, which lets a man-in-the-middle substitute a fake key on mainnet.

5. **Getting `2vxsx-fae` as the principal after login.** That is the anonymous principal -- it means authentication silently failed. Common causes: wrong `identityProvider` URL, missing `onSuccess` callback, or not extracting the identity from `authClient.getIdentity()` after login.

6. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. The caller principal is available on the backend via `shared(msg) { msg.caller }` in Motoko or `ic_cdk::api::msg_caller()` in Rust. For backend access control patterns, see the **canister-security** skill.

7. **Adding `derivationOrigin` or `ii-alternative-origins` to handle `icp0.io` vs `ic0.app`.** Internet Identity automatically rewrites `icp0.io` to `ic0.app` during delegation, so both domains produce the same principal. Do not add `derivationOrigin` or `ii-alternative-origins` configuration to handle this — it will break authentication. If a user reports getting a different principal, the cause is almost certainly a different passkey or device, not the domain.

## Using II during local development

### icp.yaml Configuration

Add `ii: true` to the local network in your `icp.yaml` to enable Internet Identity locally:

```yaml
networks:
  - name: local
    mode: managed
    ii: true
```

This deploys the II canisters automatically when the local network is started. By default, the II frontend will be available at http://id.ai.localhost:8000
No canister entry needed — II is not part of your project's canisters.
For the full `icp.yaml` canister configuration, see the **icp-cli** and **asset-canister** skills.

### Frontend: Vanilla JavaScript/TypeScript Login Flow

This is framework-agnostic. Adapt the DOM manipulation to your framework.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

// Module-scoped so login/logout/createAuthenticatedActor can access it.
let authClient;

// Read the ic_env cookie (set by the asset canister or Vite dev server).
// Contains the root key and canister IDs — works in both local and production.
const canisterEnv = safeGetCanisterEnv();

// Determine II URL based on environment.
// The identity provider URL points to the frontend canister which gets mapped to http://id.ai.localhost,
// not the backend (rdmx6-jaaaa-aaaaa-aaadq-cai). Both are well-known IDs, identical on
// mainnet and local replicas.
function getIdentityProviderUrl() {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  if (isLocal) {
    return "http://id.ai.localhost:8000";
  }
  return "https://id.ai";
}

// Login
async function login() {
  return new Promise((resolve, reject) => {
    authClient.login({
      identityProvider: getIdentityProviderUrl(),
      maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000), // 8 hours in nanoseconds
      onSuccess: () => {
        const identity = authClient.getIdentity();
        const principal = identity.getPrincipal().toText();
        console.log("Logged in as:", principal);
        resolve(identity);
      },
      onError: (error) => {
        console.error("Login failed:", error);
        reject(error);
      },
    });
  });
}

// Logout
async function logout() {
  await authClient.logout();
  // Optionally reload or reset UI state
}

// Create an authenticated agent and actor.
// Uses rootKey from the ic_env cookie — no shouldFetchRootKey or environment branching needed.
async function createAuthenticatedActor(identity, canisterId, idlFactory) {
  const agent = await HttpAgent.create({
    identity,
    host: window.location.origin,
    rootKey: canisterEnv?.IC_ROOT_KEY,
  });

  return Actor.createActor(idlFactory, { agent, canisterId });
}

// Initialization — wraps async setup in a function so this code works with
// any bundler target (Vite defaults to es2020 which lacks top-level await).
async function init() {
  authClient = await AuthClient.create();

  // Check if already authenticated (on page load)
  const isAuthenticated = await authClient.isAuthenticated();
  if (isAuthenticated) {
    const identity = authClient.getIdentity();
    const actor = await createAuthenticatedActor(identity, canisterId, idlFactory);
    // Use actor to call backend methods
  }
}

init();
```

### Backend: Access Control

Backend access control (anonymous principal rejection, role guards, caller binding in async functions) is not II-specific — the same patterns apply regardless of authentication method. See the **canister-security** skill for complete Motoko and Rust examples.
