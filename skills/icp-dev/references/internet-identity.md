# Internet Identity Authentication

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate with passkeys, WebAuthn, or hardware security keys -- no passwords, no seed phrases, no third-party identity providers. Each user gets a unique principal per dApp, preventing cross-app tracking.

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

5. **Defensive practice: bind `msg_caller()` before `.await` in Rust.** The current ic-cdk executor preserves the caller across `.await` points, but capturing it early guards against future executor changes. Always bind `let caller = ic_cdk::api::msg_caller();` at the top of async update functions.

6. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. Use `shared(msg) { msg.caller }` in Motoko or `ic_cdk::api::msg_caller()` in Rust.

7. **Not calling `agent.fetchRootKey()` in local development.** Without this, certificate verification fails on localhost. Never call it in production -- it's a security risk on mainnet.

8. **Storing auth state in `thread_local!` without stable storage (Rust)** -- `thread_local! { RefCell<T> }` is heap memory, wiped on every canister upgrade. Use `StableCell` from `ic-stable-structures` for any state that must persist across upgrades, especially ownership/auth data.

## Key Patterns

### Motoko

```motoko
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {
  var owner : ?Principal = null;

  func requireAuth(caller : Principal) : () {
    if (Principal.isAnonymous(caller)) {
      Runtime.trap("Anonymous principal not allowed. Please authenticate.");
    };
  };

  public shared (msg) func initOwner() : async Text {
    requireAuth(msg.caller);
    switch (owner) {
      case (null) { owner := ?msg.caller; "Owner set to " # Principal.toText(msg.caller) };
      case (?_existing) { "Owner already initialized" };
    };
  };

  public shared ({ caller }) func protectedEndpoint(data : Text) : async Bool {
    requireAuth(caller);
    true;
  };
};
```

### Rust

```rust
use candid::Principal;
use ic_cdk::{query, update};
use ic_stable_structures::{DefaultMemoryImpl, StableCell};
use std::cell::RefCell;

thread_local! {
    static OWNER: RefCell<StableCell<Principal, DefaultMemoryImpl>> = RefCell::new(
        StableCell::init(DefaultMemoryImpl::default(), Principal::anonymous())
    );
}

fn require_auth() -> Principal {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        ic_cdk::trap("Anonymous principal not allowed. Please authenticate.");
    }
    caller
}

#[update]
fn init_owner() -> String {
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

// For async functions, capture caller before await as defensive practice:
#[update]
async fn protected_async_action() -> String {
    let caller = require_auth(); // Capture before any await
    let _result = some_async_operation().await;
    format!("Action completed by {}", caller)
}
```
