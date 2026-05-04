---
name: internet-identity
description: "Integrate Internet Identity authentication. Covers passkey and OpenID sign-in flows, delegation handling, and principal-per-app isolation. Use when adding sign-in, login, auth, passkeys, or Internet Identity to a frontend or canister. Do NOT use for wallet integration or ICRC signer flows — use wallet-integration instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2, Node.js >= 22"
metadata:
  title: Internet Identity
  category: Auth
---

# Internet Identity Authentication

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate into II-powered apps either with passkeys stored in their devices or thorugh OpenID accounts (e.g., Google, Apple, Microsoft) -- no usernames or passwords required. Each user gets a unique principal per app, preventing cross-app tracking.

## Prerequisites

- `@icp-sdk/auth` (>= 7.0.0), `@icp-sdk/core` (>= 5.0.0)

## Canister IDs

| Canister | ID | URL | Purpose |
|----------|------------|-----|---------|
| Internet Identity (backend) | `rdmx6-jaaaa-aaaaa-aaadq-cai` |  | Manages user keys and authentication logic |
| Internet Identity (frontend) | `uqzsh-gqaaa-aaaaq-qaada-cai` | `https://id.ai` | Serves the II web app; identity provider URL points here |

## Mistakes That Break Your Build

1. **Using the wrong II URL for the environment.** The identity provider URL must point to the **frontend** canister (`uqzsh-gqaaa-aaaaq-qaada-cai`), not the backend. Local development should use `http://id.ai.localhost:8000`. Mainnet must use `https://id.ai` (which resolves to the frontend canister). Both canister IDs are well-known and identical on mainnet and local replicas -- hardcode them rather than doing a dynamic lookup.

2. **Setting delegation expiry too long.** Maximum delegation expiry is 30 days (2_592_000_000_000_000 nanoseconds). Longer values are silently clamped, which causes confusing session behavior. Use 8 hours for normal apps, 30 days maximum for "remember me" flows.

3. **Not awaiting `signIn()` or skipping the `try`/`catch`.** `authClient.signIn()` returns a promise that rejects when the user closes the popup or authentication fails. Without `await` and a `catch`, those failures are silently swallowed.

4. **Using `shouldFetchRootKey` or `fetchRootKey()` instead of the `ic_env` cookie.** The `ic_env` cookie (set by the asset canister or the Vite dev server) already contains the root key as `IC_ROOT_KEY`. Pass it via the `rootKey` option to `HttpAgent.create()` — this works in both local and production environments without environment branching. See the icp-cli skill's `references/binding-generation.md` for the pattern. Never call `fetchRootKey()` — it fetches the root key from the replica at runtime, which lets a man-in-the-middle substitute a fake key on mainnet.

5. **Getting `2vxsx-fae` as the principal after sign-in.** That is the anonymous principal -- it means authentication silently failed. Common causes: wrong `identityProvider` URL passed to the `AuthClient` constructor, an unhandled rejection from `signIn()`, or reading `getIdentity()` before `signIn()` resolved.

6. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. The caller principal is available on the backend via `shared(msg) { msg.caller }` in Motoko or `ic_cdk::api::msg_caller()` in Rust. For backend access control patterns, see the **canister-security** skill.

7. **Adding `derivationOrigin` or `ii-alternative-origins` to handle `icp0.io` vs `ic0.app`.** Internet Identity automatically rewrites `icp0.io` to `ic0.app` during delegation, so both domains produce the same principal. Do not add `derivationOrigin` or `ii-alternative-origins` configuration to handle this — it will break authentication. If a user reports getting a different principal, the cause is almost certainly a different passkey or device, not the domain.

8. **Generating the attribute nonce on the frontend.** The nonce passed to `requestAttributes` MUST come from a backend canister call. A frontend-generated nonce defeats replay protection: the canister cannot verify that the bundle's `implicit:nonce` matches an action it actually started. Have the backend mint and return the nonce from a `registerBegin`-style method, and check it against the bundle's implicit fields when the user calls the protected method.

9. **Reading attribute data without verifying the signer.** `msg_caller_info_data` (Rust) and `Prim.callerInfoData` (Motoko) return whatever bundle the caller provided. The IC verifies the signature, not the identity of the signer — any canister can produce a valid bundle. Check `msg_caller_info_signer` / `Prim.callerInfoSigner` against `rdmx6-jaaaa-aaaaa-aaadq-cai` (Internet Identity) before trusting any attribute, otherwise an attacker canister can forge attributes like `email = "admin@you.com"`.

## Using II during local development

You have two choices for local development:
* Starting with `icp-cli >= 0.2.4` the local network can validate signatures from https://id.ai, so you can use mainnet identities with the local network.
* You can configure your local network to deploy internet identity to the local network which makes it accessible at http://id.ai.localhost:8000 by default.

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

### Frontend: Vanilla JavaScript/TypeScript Sign-In Flow

This is framework-agnostic. Adapt the DOM manipulation to your framework.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

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

// Construct once — identityProvider (and optionally derivationOrigin or
// openIdProvider for one-click sign-in: 'google' | 'apple' | 'microsoft')
// are configured at construction time, not per sign-in.
const authClient = new AuthClient({
  identityProvider: getIdentityProviderUrl(),
});

// Sign in: signIn() returns the new Identity directly and rejects if the user
// closes the popup or authentication fails.
async function signIn() {
  try {
    const identity = await authClient.signIn({
      maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000), // 8 hours in nanoseconds
    });
    console.log("Signed in as:", identity.getPrincipal().toText());
    return identity;
  } catch (error) {
    console.error("Sign-in failed:", error);
    throw error;
  }
}

// Sign out
async function signOut() {
  await authClient.signOut();
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
  // isAuthenticated() is sync; getIdentity() is async.
  if (authClient.isAuthenticated()) {
    const identity = await authClient.getIdentity();
    const actor = await createAuthenticatedActor(identity, canisterId, idlFactory);
    // Use actor to call backend methods
  }
}

init();
```

### Frontend: Requesting Identity Attributes

When the backend needs more than the user's principal (e.g., a verified email), Internet Identity can return signed attributes alongside the delegation. The backend issues a nonce scoped to a specific action; the frontend requests the attributes during sign-in; the backend verifies the bundle when the user calls the protected method.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { AttributesIdentity } from "@icp-sdk/core/identity";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

async function registerWithEmail(authClient, backendCanisterId, backendIdl, appCanisterId, appIdl) {
  // 1. The backend issues a nonce scoped to this registration.
  //    Frontend-generated nonces defeat replay protection — see Mistake #8.
  const anonymousAgent = await HttpAgent.create();
  const backend = Actor.createActor(backendIdl, {
    agent: anonymousAgent,
    canisterId: backendCanisterId,
  });
  const nonce = await backend.registerBegin();

  // 2. Run sign-in and the attribute request in parallel; the user sees
  //    a single Internet Identity interaction.
  const signInPromise = authClient.signIn();
  const attributesPromise = authClient.requestAttributes({
    keys: ["email"],
    nonce,
  });

  const identity = await signInPromise;
  const { data, signature } = await attributesPromise;

  // 3. Wrap the identity so the signed attributes travel with each call.
  const identityWithAttributes = new AttributesIdentity({
    inner: identity,
    attributes: { data, signature },
    // The Internet Identity backend canister ID is the attribute signer.
    signer: { canisterId: Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai") },
  });

  // 4. Call the protected method. The backend verifies the bundle's
  //    implicit:nonce, implicit:origin, and implicit:issued_at_timestamp_ns,
  //    then reads the requested attributes (email here).
  const agent = await HttpAgent.create({ identity: identityWithAttributes });
  const app = Actor.createActor(appIdl, { agent, canisterId: appCanisterId });
  await app.registerFinish();
}
```

Each signed bundle carries three implicit fields the backend MUST verify:
- `implicit:nonce` — matches the canister-issued nonce, preventing replay across actions and users.
- `implicit:origin` — the frontend origin, preventing a malicious dapp from forwarding bundles to a different backend.
- `implicit:issued_at_timestamp_ns` — issuance time, letting the canister reject stale bundles even when the nonce is still valid.

For OpenID one-click sign-in, attributes can be scoped to the provider via the `scopedKeys` helper. Authentication and attribute sharing happen in a single step (no extra prompt):

```javascript
import { AuthClient, scopedKeys } from "@icp-sdk/auth/client";

const authClient = new AuthClient({
  identityProvider: getIdentityProviderUrl(),
  openIdProvider: "google",
});
const nonce = await backend.registerBegin();
const signInPromise = authClient.signIn();
// Requests name, email, and verified_email from the Google account
// linked to the user's Internet Identity.
const attributesPromise = authClient.requestAttributes({
  keys: scopedKeys({ openIdProvider: "google" }),
  nonce,
});
```

### Backend: Reading Identity Attributes

When the frontend wraps an identity with `AttributesIdentity`, every call carries a verified attribute bundle.

- **Rust** (ic-cdk >= 0.20.1): `ic_cdk::api::msg_caller_info_data() -> Vec<u8>`, `ic_cdk::api::msg_caller_info_signer() -> Option<Principal>`.
- **Motoko** (compiler with caller_info prims, e.g. >= 0.16): `Prim.callerInfoData<system>() : Blob`, `Prim.callerInfoSigner<system>() : Blob` (empty when no signer).

**Always verify the signer first.** The IC checks that the bundle is signed; it does not check *who* signed it. Any canister can produce a valid bundle. Trust the data only when the signer matches the trusted issuer (`rdmx6-jaaaa-aaaaa-aaadq-cai` for Internet Identity).

The data is Candid-encoded as an ICRC-3 `Value::Map` whose entries are:
- `implicit:nonce` (Blob) — must match a nonce your canister minted for this user/action.
- `implicit:origin` (Text) — must match a trusted frontend origin.
- `implicit:issued_at_timestamp_ns` (Nat) — reject if outside your freshness window.
- Plain attribute keys (e.g., `"email"`) for default-scope attributes.
- OpenID-scoped keys (e.g., `"openid:https://accounts.google.com:email"`) when `scopedKeys` was used on the frontend.

```motoko
import Prim "mo:prim";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";

persistent actor {
  let iiPrincipal = Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai");

  type Icrc3Value = {
    #Nat : Nat;
    #Int : Int;
    #Blob : Blob;
    #Text : Text;
    #Array : [Icrc3Value];
    #Map : [(Text, Icrc3Value)];
  };

  func lookupText(entries : [(Text, Icrc3Value)], key : Text) : ?Text {
    for ((k, v) in entries.vals()) {
      if (k == key) { switch v { case (#Text t) { return ?t }; case _ {} } };
    };
    null;
  };

  // Returns the verified attribute map, trapping if the signer is not II.
  func iiAttributes() : [(Text, Icrc3Value)] {
    let signer = Prim.callerInfoSigner<system>();
    if (signer.size() == 0 or Principal.fromBlob(signer) != iiPrincipal) {
      Runtime.trap("Untrusted attribute signer");
    };
    let data = Prim.callerInfoData<system>();
    let ?value : ?Icrc3Value = from_candid (data) else Runtime.trap("invalid attribute bundle");
    let #Map(entries) = value else Runtime.trap("expected attribute map");
    entries
  };

  public shared ({ caller }) func registerFinish() : async Text {
    if (Principal.isAnonymous(caller)) Runtime.trap("Anonymous caller not allowed");
    let entries = iiAttributes();

    let ?origin = lookupText(entries, "implicit:origin") else Runtime.trap("missing origin");
    if (origin != "https://your-app.icp0.io") Runtime.trap("Wrong origin");
    // Compare implicit:nonce to the nonce minted in registerBegin and check
    // implicit:issued_at_timestamp_ns is within your freshness window (omitted).

    let ?email = lookupText(entries, "email") else Runtime.trap("missing email");
    "Registered " # Principal.toText(caller) # " with email " # email
  };
};
```

```rust
use candid::{decode_one, CandidType, Deserialize, Principal};
use ic_cdk::api::{msg_caller, msg_caller_info_data, msg_caller_info_signer};
use ic_cdk::update;

const II_PRINCIPAL: &str = "rdmx6-jaaaa-aaaaa-aaadq-cai";

#[derive(CandidType, Deserialize)]
enum Icrc3Value {
    Nat(candid::Nat),
    Int(candid::Int),
    Blob(Vec<u8>),
    Text(String),
    Array(Vec<Icrc3Value>),
    Map(Vec<(String, Icrc3Value)>),
}

fn lookup_text<'a>(entries: &'a [(String, Icrc3Value)], key: &str) -> Option<&'a str> {
    entries.iter().find_map(|(k, v)| match v {
        Icrc3Value::Text(s) if k == key => Some(s.as_str()),
        _ => None,
    })
}

// Returns the verified attribute entries, trapping if the signer is not II.
fn ii_attributes() -> Vec<(String, Icrc3Value)> {
    let trusted = Principal::from_text(II_PRINCIPAL).unwrap();
    if msg_caller_info_signer() != Some(trusted) {
        ic_cdk::trap("Untrusted attribute signer");
    }
    let bundle = msg_caller_info_data();
    let value: Icrc3Value = decode_one(&bundle)
        .unwrap_or_else(|_| ic_cdk::trap("invalid attribute bundle"));
    match value {
        Icrc3Value::Map(entries) => entries,
        _ => ic_cdk::trap("expected attribute map"),
    }
}

#[update]
fn register_finish() -> String {
    let caller = msg_caller();
    if caller == Principal::anonymous() { ic_cdk::trap("Anonymous caller not allowed"); }
    let entries = ii_attributes();

    let origin = lookup_text(&entries, "implicit:origin")
        .unwrap_or_else(|| ic_cdk::trap("missing origin"));
    if origin != "https://your-app.icp0.io" { ic_cdk::trap("Wrong origin"); }
    // Compare implicit:nonce to the nonce minted in register_begin and check
    // implicit:issued_at_timestamp_ns is within your freshness window (omitted).

    let email = lookup_text(&entries, "email")
        .unwrap_or_else(|| ic_cdk::trap("missing email"));
    format!("Registered {} with email {}", caller, email)
}
```

**Storing the nonce:** mint it in `registerBegin` (or equivalent), persist it in stable memory keyed by the user's principal and the action name, and mark it consumed in `registerFinish` so a bundle cannot be replayed. Use a short freshness window so abandoned attempts age out. See the **stable-memory** skill for storage patterns.

### Backend: Access Control

Backend access control (anonymous principal rejection, role guards, caller binding in async functions) is not II-specific — the same patterns apply regardless of authentication method. See the **canister-security** skill for complete Motoko and Rust examples.
