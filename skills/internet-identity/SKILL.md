---
name: internet-identity
title: Internet Identity Auth
category: Auth
description: "Integrate Internet Identity authentication into your app. Enable users to sign in securely."
endpoints: 6
version: 5.0.4
status: stable
dependencies: [ii]
requires: [icp-sdk/icp-cli, icp-sdk/ic-wasm, icp-sdk/auth >= 4.0.1]
tags: [auth, authentication, login, passkey, webauthn, openid, oidc, identity, delegation, principal]
---

# Internet Identity Authentication

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate into II-powered apps either with passkeys stored in their devices or thorugh OpenID accounts (e.g., Google, Apple, Microsoft) -- no login or passwords required. Each user gets a unique principal per app, preventing cross-app tracking.

## Prerequisites

1. [Node.js](https://nodejs.org/en) (LTS)
2. `@icp-sdk/icp-cli`:
    ```sh
    npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm
    ```
    For Motoko:
    ```sh
    npm install -g ic-mops
    ```
    For Rust:
    ```sh
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    rustup target add wasm32-unknown-unknown
    ```
    For Windows, Linux, or Docker-based development, please read the full instructions [here](https://github.com/dfinity/icp-cli/blob/1c26bb0c6f0f4b6813b682bf1b3e5fb9ae0c5cf7/docs/guides/installation.md).
3. `@icp-sdk/auth`:
    ```sh
    npm install -g @icp-sdk/auth
    ```

## Canister IDs

| Canister | ID | URL | Purpose |
|----------|------------|-----|---------|
| Internet Identity | `rdmx6-jaaaa-aaaaa-aaadq-cai` | `https://id.ai` | Stores and manages user keys, serves the II web app over HTTPS |

## Mistakes That Break Your Build

1. **Using the wrong II URL for the environment.** Local development must point to `http://<local-ii-canister-id>.localhost:4943` (this canister ID may be different from mainnet). Mainnet must use `https://id.ai`. Hardcoding one breaks the other. The local II canister ID is assigned dynamically when you run `icp deploy internet_identity` -- read it from `process.env.CANISTER_ID_INTERNET_IDENTITY` (note: this auto-generated env var may work differently in icp-cli than it did in the legacy tooling; verify your build tooling picks it up) or your canister_ids.json (path may differ in icp-cli projects compared to the legacy `.icp/local/canister_ids.json` location).

3. **Setting delegation expiry too long.** Maximum delegation expiry is 30 days (2_592_000_000_000_000 nanoseconds). Longer values are silently clamped, which causes confusing session behavior. Use 8 hours for normal apps, 30 days maximum for "remember me" flows.

4. **Not handling auth callbacks.** The `authClient.login()` call requires `onSuccess` and `onError` callbacks. Without them, login failures are silently swallowed.

5. **Defensive practice: bind `msg_caller()` before `.await` in Rust.** The current ic-cdk executor preserves the caller across `.await` points, but capturing it early guards against future executor changes. Always bind `let caller = ic_cdk::api::msg_caller();` at the top of async update functions.

6. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. Use `shared(msg) { msg.caller }` in Motoko or `ic_cdk::api::msg_caller()` in Rust.

7. **Not calling `agent.fetchRootKey()` in local development.** Without this, certificate verification fails on localhost. Never call it in production -- it's a security risk on mainnet.

8. **Storing auth state in `thread_local!` without stable storage (Rust)** -- `thread_local! { RefCell<T> }` is heap memory, wiped on every canister upgrade. Use `StableCell` from `ic-stable-structures` for any state that must persist across upgrades, especially ownership/auth data.

## Implementation

### icp.yaml Configuration

For local development, you just need to add the `ii` property to the local network to enable Internet Identity.

Here's an example icp.yaml configuration (assume that the `frontend` canister is generated using `icp new` using the `static-website` template):

```yaml
# yaml-language-server: $schema=https://github.com/dfinity/icp-cli/raw/refs/tags/v0.1.0/docs/schemas/icp-yaml-schema.json

canisters:
  - name: frontend
    recipe:
      type: "@dfinity/asset-canister@v2.1.0"
      configuration:
        build:
          # Install the dependencies
          # Eventually you might want to use `npm ci` to lock your dependencies
          - npm install
          - npm run build
        dir: dist

networks:
  - name: local
    mode: managed
    ii: true
```

<!-- Reviewed till here -->

### Frontend: Vanilla JavaScript/TypeScript Login Flow

This is framework-agnostic. Adapt the DOM manipulation to your framework.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";

// 1. Create the auth client
const authClient = await AuthClient.create();

// 2. Determine II URL based on environment
// The local II canister gets a different canister ID each time you deploy it.
// Pass it via an environment variable at build time (e.g., Vite: import.meta.env.VITE_II_CANISTER_ID).
function getIdentityProviderUrl() {
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  if (isLocal) {
    // Read from env variable set during build, or from canister_ids.json
    // For Vite: define VITE_II_CANISTER_ID in .env.local
    // For webpack: use DefinePlugin with process.env.II_CANISTER_ID
    const iiCanisterId = import.meta.env.VITE_II_CANISTER_ID
      ?? process.env.CANISTER_ID_INTERNET_IDENTITY  // auto-generated by build tooling (verify this works with icp-cli)
      ?? "be2us-64aaa-aaaaa-qaabq-cai"; // fallback -- replace with your actual local II canister ID
    return `http://${iiCanisterId}.localhost:4943`;
  }
  return "https://id.ai";
}

// 3. Login
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

// 4. Create an authenticated agent and actor
async function createAuthenticatedActor(identity, canisterId, idlFactory) {
  const isLocal = window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.hostname.endsWith(".localhost");

  const agent = await HttpAgent.create({
    identity,
    host: isLocal ? "http://localhost:4943" : "https://icp-api.io",
    ...(isLocal && { shouldFetchRootKey: true, verifyQuerySignatures: false }),
  });

  return Actor.createActor(idlFactory, { agent, canisterId });
}

// 5. Logout
async function logout() {
  await authClient.logout();
  // Optionally reload or reset UI state
}

// 6. Check if already authenticated (on page load)
const isAuthenticated = await authClient.isAuthenticated();
if (isAuthenticated) {
  const identity = authClient.getIdentity();
  // Restore session -- create actor, update UI
}
```

### Backend: Motoko

Requires installing the Mops [Motoko package manager](https://cli.mops.one/):

```sh
npm install -g ic-mops
```

```motoko
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {
  // Owner/admin principal
  var owner : ?Principal = null;

  // Helper: reject anonymous callers
  func requireAuth(caller : Principal) : () {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Anonymous principal not allowed. Please authenticate.");
    };
  };

  // Initialize the first authenticated caller as owner
  public shared (msg) func initOwner() : async Text {
    requireAuth(msg.caller);
    switch (owner) {
      case (null) {
        owner := ?msg.caller;
        "Owner set to " # Principal.toText(msg.caller);
      };
      case (?_existing) {
        "Owner already initialized";
      };
    };
  };

  // Owner-only endpoint example
  public shared (msg) func adminAction() : async Text {
    requireAuth(msg.caller);
    switch (owner) {
      case (?o) {
        if (o != msg.caller) {
          Runtime.trap("Only the owner can call this function.");
        };
        "Admin action performed";
      };
      case (null) {
        Runtime.trap("Owner not set. Call initOwner first.");
      };
    };
  };

  // Public query: anyone can call, but returns different data for authenticated users
  public shared query (msg) func whoAmI() : async Text {
    if (Principal.isAnonymous(msg.caller)) {
      "You are not authenticated (anonymous)";
    } else {
      "Your principal: " # Principal.toText(msg.caller);
    };
  };

  // Getting caller principal in shared functions
  // ALWAYS use `shared (msg)` or `shared ({ caller })` syntax:
  public shared ({ caller }) func protectedEndpoint(data : Text) : async Bool {
    requireAuth(caller);
    // Use `caller` for authorization checks
    true;
  };
};
```

### Backend: Rust

```toml
# Cargo.toml
[package]
name = "ii_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.19"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
ic-stable-structures = "0.7"
```

```rust
use candid::Principal;
use ic_cdk::{query, update};
use ic_stable_structures::{DefaultMemoryImpl, StableCell};
use std::cell::RefCell;

thread_local! {
    // Principal::anonymous() is used as the "not set" sentinel.
    // Option<Principal> does not implement Storable, so we store Principal directly.
    static OWNER: RefCell<StableCell<Principal, DefaultMemoryImpl>> = RefCell::new(
        StableCell::init(DefaultMemoryImpl::default(), Principal::anonymous())
    );
}

/// Reject anonymous principal. Call this at the top of every protected endpoint.
fn require_auth() -> Principal {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        ic_cdk::trap("Anonymous principal not allowed. Please authenticate.");
    }
    caller
}

#[update]
fn init_owner() -> String {
    // Defensive: capture caller before any .await calls.
    let caller = require_auth();

    OWNER.with(|owner| {
        let mut cell = owner.borrow_mut();
        let current = *cell.get();
        if current == Principal::anonymous() {
            cell.set(caller);
            format!("Owner set to {}", caller)
        } else {
            "Owner already initialized".to_string()
        }
    })
}

#[update]
fn admin_action() -> String {
    let caller = require_auth();

    OWNER.with(|owner| {
        let cell = owner.borrow();
        let current = *cell.get();
        if current == Principal::anonymous() {
            ic_cdk::trap("Owner not set. Call init_owner first.");
        } else if current == caller {
            "Admin action performed".to_string()
        } else {
            ic_cdk::trap("Only the owner can call this function.");
        }
    })
}

#[query]
fn who_am_i() -> String {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        "You are not authenticated (anonymous)".to_string()
    } else {
        format!("Your principal: {}", caller)
    }
}

// For async functions, capture caller before await as defensive practice:
#[update]
async fn protected_async_action() -> String {
    let caller = require_auth(); // Capture before any await
    let _result = some_async_operation().await;
    format!("Action completed by {}", caller)
}
```

**Rust defensive practice:** Bind `let caller = ic_cdk::api::msg_caller();` at the top of async update functions. The current ic-cdk executor preserves caller across `.await` points via protected tasks, but capturing it early guards against future executor changes.

## Deploy & Test

### Local Deployment

```bash
# Start the local replica
icp network start -d

# Deploy II canister and your backend
icp deploy internet_identity
icp deploy backend

# Verify II is running
icp canister status internet_identity
```

### Mainnet Deployment

```bash
# II is already on mainnet -- only deploy your canisters
icp deploy -e ic backend
```

## Verify It Works

```bash
# 1. Check II canister is running
icp canister status internet_identity
# Expected: Status: Running

# 2. Test anonymous rejection from CLI
icp canister call backend adminAction
# Expected: Error containing "Anonymous principal not allowed"

# 3. Test whoAmI as anonymous
icp canister call backend whoAmI
# Expected: ("You are not authenticated (anonymous)")

# 4. Test whoAmI as authenticated identity
icp canister call backend whoAmI
# Expected: ("Your principal: <your-identity-principal>")
# Note: icp CLI calls use the current identity, not anonymous,
# unless you explicitly use --identity anonymous

# 5. Test with explicit anonymous identity
icp identity use anonymous
icp canister call backend adminAction
# Expected: Error containing "Anonymous principal not allowed"
icp identity use default  # Switch back

# 6. Open II in browser for local dev
# Visit: http://<internet_identity_canister_id>.localhost:4943
```
# You should see the Internet Identity login page
```
