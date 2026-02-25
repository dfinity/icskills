---
id: internet-identity
name: Internet Identity Auth
category: Auth
description: "Integrate Internet Identity authentication into frontend and backend canisters. Delegation, session management, and anchor handling."
endpoints: 6
version: 4.0.0
status: stable
dependencies: [asset-canister]
---

# Internet Identity Authentication
> version: 1.0.0 | requires: [icp-cli >= 0.1.0, @dfinity/auth-client >= 3.0]

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate with passkeys, WebAuthn, or hardware security keys -- no passwords, no seed phrases, no third-party identity providers. Each user gets a unique principal per dApp, preventing cross-app tracking.

## Prerequisites

- icp-cli >= 0.1.0 (`brew install dfinity/tap/icp-cli`)
- Node.js >= 18 (for frontend)
- `@dfinity/auth-client` npm package (>= 3.0.0)
- `@dfinity/agent` npm package
- `@dfinity/identity` npm package
- `@dfinity/principal` npm package

## Canister IDs

| Environment | Canister ID | URL |
|-------------|-------------|-----|
| Mainnet | `rdmx6-jaaaa-aaaaa-aaadq-cai` | `https://identity.ic0.app` (also `https://identity.internetcomputer.org`) |
| Local | Assigned on deploy | `http://<local-canister-id>.localhost:4943` |

## Mistakes That Break Your Build

1. **Not rejecting anonymous principal.** The anonymous principal `2vxsx-fae` is sent when a user is not authenticated. If your backend does not explicitly reject it, unauthenticated users can call protected endpoints. ALWAYS check `Principal.isAnonymous(caller)` and reject.

2. **Using the wrong II URL for the environment.** Local development must point to `http://<local-ii-canister-id>.localhost:4943` (this canister ID is different from mainnet). Mainnet must use `https://identity.ic0.app`. Hardcoding one breaks the other. The local II canister ID is assigned dynamically when you run `icp deploy internet_identity` -- read it from `process.env.CANISTER_ID_INTERNET_IDENTITY` (note: this auto-generated env var may work differently in icp-cli than it did in the legacy tooling; verify your build tooling picks it up) or your canister_ids.json (path may differ in icp-cli projects compared to the legacy `.icp/local/canister_ids.json` location).

3. **Setting delegation expiry too long.** Maximum delegation expiry is 30 days (2_592_000_000_000_000 nanoseconds). Longer values are silently clamped, which causes confusing session behavior. Use 8 hours for normal apps, 30 days maximum for "remember me" flows.

4. **Not handling auth callbacks.** The `authClient.login()` call requires `onSuccess` and `onError` callbacks. Without them, login failures are silently swallowed.

5. **Reading `ic_cdk::caller()` after an await in Rust.** After any `.await` point, `caller()` returns the canister's own principal, not the original caller. Capture the caller into a variable BEFORE any await.

6. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. Use `shared(msg) { msg.caller }` in Motoko or `ic_cdk::caller()` in Rust.

7. **Not calling `agent.fetchRootKey()` in local development.** Without this, certificate verification fails on localhost. Never call it in production -- it's a security risk on mainnet.

## Implementation

### icp.json Configuration

For local development, download the II canister WASM from the [dfinity/internet-identity releases](https://github.com/dfinity/internet-identity/releases). Place the `.wasm.gz` and `.did` files in your project.

```json
{
  "canisters": {
    "internet_identity": {
      "type": "custom",
      "candid": "deps/internet-identity/internet_identity.did",
      "wasm": "deps/internet-identity/internet_identity_dev.wasm.gz",
      "build": "",
      "remote": {
        "id": {
          "ic": "rdmx6-jaaaa-aaaaa-aaadq-cai"
        }
      }
    }
  }
}
```

The `remote.id.ic` field tells `icp` to skip deploying this canister on mainnet (use the existing one). Locally, `icp` deploys the provided WASM.

### Frontend: Vanilla JavaScript/TypeScript Login Flow

This is framework-agnostic. Adapt the DOM manipulation to your framework.

```javascript
import { AuthClient } from "@dfinity/auth-client";
import { HttpAgent, Actor } from "@dfinity/agent";

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
  return "https://identity.ic0.app";
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

  const agent = new HttpAgent({
    identity,
    host: isLocal ? "http://localhost:4943" : "https://icp-api.io",
    ...(isLocal && { verifyQuerySignatures: false }),
  });

  // CRITICAL: Fetch root key for local development only
  if (isLocal) {
    await agent.fetchRootKey();
  }

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
[dependencies]
ic-cdk = "0.18"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
```

```rust
use candid::Principal;
use ic_cdk::{caller, query, update};
use std::cell::RefCell;

thread_local! {
    static OWNER: RefCell<Option<Principal>> = RefCell::new(None);
}

/// Reject anonymous principal. Call this at the top of every protected endpoint.
fn require_auth() -> Principal {
    let caller = caller();
    if caller == Principal::anonymous() {
        ic_cdk::trap("Anonymous principal not allowed. Please authenticate.");
    }
    caller
}

#[update]
fn init_owner() -> String {
    // IMPORTANT: Capture caller BEFORE any .await calls.
    // After .await, ic_cdk::caller() returns the canister's own principal.
    let caller = require_auth();

    OWNER.with(|owner| {
        let mut owner = owner.borrow_mut();
        match *owner {
            None => {
                *owner = Some(caller);
                format!("Owner set to {}", caller)
            }
            Some(_) => "Owner already initialized".to_string(),
        }
    })
}

#[update]
fn admin_action() -> String {
    let caller = require_auth();

    OWNER.with(|owner| {
        let owner = owner.borrow();
        match *owner {
            Some(o) if o == caller => "Admin action performed".to_string(),
            Some(_) => ic_cdk::trap("Only the owner can call this function."),
            None => ic_cdk::trap("Owner not set. Call init_owner first."),
        }
    })
}

#[query]
fn who_am_i() -> String {
    let caller = caller();
    if caller == Principal::anonymous() {
        "You are not authenticated (anonymous)".to_string()
    } else {
        format!("Your principal: {}", caller)
    }
}

// For async functions, ALWAYS capture caller before await:
#[update]
async fn protected_async_action() -> String {
    let caller = require_auth(); // Capture HERE, before any await

    // After this await, ic_cdk::caller() would return wrong principal
    let _result = some_async_operation().await; // (pseudocode -- replace with your actual async call)

    // Use the captured `caller` variable, NOT ic_cdk::caller()
    format!("Action completed by {}", caller)
}
```

**Rust critical rule:** In any `async` update function, `ic_cdk::caller()` returns the correct value only before the first `.await`. After any `.await`, it returns the canister's own principal. Always bind `let caller = ic_cdk::caller();` at the top of the function.

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
icp identity default anonymous
icp canister call backend adminAction
# Expected: Error containing "Anonymous principal not allowed"
icp identity default default  # Switch back

# 6. Open II in browser for local dev
# Visit: http://<internet_identity_canister_id>.localhost:4943
# You should see the Internet Identity login page
```
