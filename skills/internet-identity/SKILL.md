---
name: internet-identity
description: "Integrate Internet Identity authentication. Covers passkey and OpenID sign-in flows, delegation handling, and principal-per-app isolation. Use when adding sign-in, login, auth, passkeys, or Internet Identity to a frontend or canister. Do NOT use for wallet integration or ICRC signer flows — use wallet-integration instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.4, Node.js >= 22"
metadata:
  title: Internet Identity
  category: Auth
---

# Internet Identity Authentication

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate into II-powered apps either with passkeys stored in their devices or through OpenID accounts (e.g., Google, Apple, Microsoft) -- no usernames or passwords required. Each user gets a unique principal per app, preventing cross-app tracking.

## Prerequisites

- `@icp-sdk/auth` (>= 7.0.0), `@icp-sdk/core` (>= 5.3.0) (`AttributesIdentity` was added in core v5.3.0)
- For the Motoko backend example: `mo:core` >= 2.5.0 (the `CallerAttributes` module that wraps the caller-info primitives behind a single trusted-signer-aware call)

## Canister IDs

| Canister | ID | URL | Purpose |
|----------|------------|-----|---------|
| Internet Identity (backend) | `rdmx6-jaaaa-aaaaa-aaadq-cai` |  | Manages user keys and authentication logic |
| Internet Identity (frontend) | `uqzsh-gqaaa-aaaaq-qaada-cai` | `https://id.ai` | Serves the II web app; identity provider URL points here |

## Mistakes That Break Your Build

1. **Using the wrong II URL for the environment.** The identity provider URL must point to the **frontend** canister (`uqzsh-gqaaa-aaaaq-qaada-cai`), not the backend. Mainnet uses `https://id.ai/authorize`. Local-only II (when `ii: true` is set in `icp.yaml`) uses `http://id.ai.localhost:8000/authorize`. Both canister IDs are well-known and identical on mainnet and local replicas — hardcode them rather than doing a dynamic lookup.

2. **Forgetting `/authorize` in the `identityProvider` URL.** In `@icp-sdk/auth` 7.x the URL is used verbatim; the client does **not** append `/authorize` for you (it did in 5.x). Passing `https://id.ai` opens the II home page in the popup and never returns a delegation — the login button appears to do nothing. Always include the `/authorize` path.

3. **Setting delegation expiry too long.** Maximum delegation expiry is 30 days (2_592_000_000_000_000 nanoseconds). Longer values are silently clamped, which causes confusing session behavior. Use 8 hours for normal apps, 30 days maximum for "remember me" flows.

4. **Not awaiting `signIn()` or skipping the `try`/`catch`.** `authClient.signIn()` returns a promise that rejects when the user closes the popup or authentication fails. Without `await` and a `catch`, those failures are silently swallowed.

5. **Using `shouldFetchRootKey` or `fetchRootKey()` instead of the `ic_env` cookie.** The `ic_env` cookie (set by the asset canister or the Vite dev server) already contains the root key as `IC_ROOT_KEY`. Pass it via the `rootKey` option to `HttpAgent.create()` — this works in both local and production environments without environment branching. See the icp-cli skill's `references/binding-generation.md` for the pattern. Never call `fetchRootKey()` — it fetches the root key from the replica at runtime, which lets a man-in-the-middle substitute a fake key on mainnet.

6. **Getting `2vxsx-fae` as the principal after sign-in.** That is the anonymous principal -- it means authentication silently failed. Common causes: wrong `identityProvider` URL passed to the `AuthClient` constructor (especially missing `/authorize`), an unhandled rejection from `signIn()`, or reading `getIdentity()` before `signIn()` resolved.

7. **Passing principal as string to backend.** The `AuthClient` gives you an `Identity` object. Backend canister methods receive the caller principal automatically via the IC protocol -- you do not pass it as a function argument. The caller principal is available on the backend via `shared(msg) { msg.caller }` in Motoko or `ic_cdk::api::msg_caller()` in Rust. For backend access control patterns, see the **canister-security** skill.

8. **Adding `derivationOrigin` or `ii-alternative-origins` to handle `icp0.io` vs `ic0.app`.** Internet Identity automatically rewrites `icp0.io` to `ic0.app` during delegation, so both domains produce the same principal. Do not add `derivationOrigin` or `ii-alternative-origins` configuration to handle this — it will break authentication. If a user reports getting a different principal, the cause is almost certainly a different passkey or device, not the domain.

9. **Generating the attribute nonce on the frontend.** The nonce passed to `requestAttributes` MUST come from a backend canister call. A frontend-generated nonce defeats replay protection: the canister cannot verify that the bundle's `implicit:nonce` matches an action it actually started. Have the backend mint and return the nonce from a `registerBegin`-style method, and check it against the bundle's implicit fields when the user calls the protected method.

10. **Reading attribute data without verifying the signer.** The IC verifies the signature, not the identity of the signer — any canister can produce a valid bundle. The trusted signer is `rdmx6-jaaaa-aaaaa-aaadq-cai` (Internet Identity). The check looks different per language:
    - **Motoko**: prefer `mo:core/CallerAttributes`. `CallerAttributes.getAttributes<system>()` returns `?Blob` and traps if the signer isn't listed in the canister's `trusted_attribute_signers` env var. Configure that env var in `icp.yaml` (see "Backend: Reading Identity Attributes"). Don't roll your own check on top of `Prim.callerInfoSigner` unless you have a reason to.
    - **Rust**: there is no CDK wrapper yet. Always check `msg_caller_info_signer()` against the trusted issuer principal before reading `msg_caller_info_data()`. Skipping this lets an attacker canister forge attributes like `email = "admin@you.com"`.

11. **Substituting `{tid}` in the Microsoft scoped-key prefix.** The `microsoft` OpenID provider URL is the literal string `https://login.microsoftonline.com/{tid}/v2.0` — `{tid}` is part of the URL, not a tenant-ID placeholder you fill in. Bundle keys returned by `scopedKeys({ openIdProvider: 'microsoft' })` look like `openid:https://login.microsoftonline.com/{tid}/v2.0:email` exactly, and the backend must look up that literal key. Replacing `{tid}` with a tenant GUID will silently miss every attribute lookup.

12. **Treating `email` as verified.** `email` and `verified_email` are distinct keys.
    - `email` is the raw email string from the user's II-linked account. II does not check it. Treat it as user-supplied input.
    - `verified_email` is the same email as `email`, but only present when the source OpenID provider (e.g., Google) marked it as verified and II surfaced that signal through.
    Use `verified_email` for any access gating (admin allowlists, capability checks). Use `email` only for soft uses like contact info or mailing lists. Request both for fallback behaviour: both are returned with the same value when the source provider marked the email as verified, only `email` when it didn't.

## Using II during local development

**Default: use mainnet II from your local network.** Starting with `icp-cli >= 0.2.4`, the local network (pocket-ic, launched by `icp-cli-network-launcher`) is configured to trust the mainnet subnet's BLS signatures. Delegations signed by `https://id.ai` are accepted by your local replica, so both the sign-in flow *and* authenticated calls to a locally-deployed backend just work — no extra config in `icp.yaml`, no local II canister to manage, and the UI is the real one your users will see.

Point your frontend at `https://id.ai/authorize` unconditionally and you're done.

### Fallback: deploy II locally

Only use this if you need fully-offline dev or want to test against a specific II build. Add `ii: true` to the local network in your `icp.yaml`:

```yaml
networks:
  - name: local
    mode: managed
    ii: true
```

This deploys the II canisters automatically when the local network is started. The II frontend will be available at `http://id.ai.localhost:8000`, and the `identityProvider` URL becomes `http://id.ai.localhost:8000/authorize`. No canister entry is needed in your project — II is not part of your project's canisters. For the full `icp.yaml` canister configuration, see the **icp-cli** and **asset-canister** skills.

### Frontend: Vanilla JavaScript/TypeScript Sign-In Flow

This is framework-agnostic. Adapt the DOM manipulation to your framework.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

// Read the ic_env cookie (set by the asset canister or Vite dev server).
// Contains the root key and canister IDs — works in both local and production.
const canisterEnv = safeGetCanisterEnv();

// Construct once — identityProvider (and optionally derivationOrigin or
// openIdProvider for one-click sign-in: 'google' | 'apple' | 'microsoft')
// are configured at construction time, not per sign-in. Always include the
// `/authorize` path — the client uses the URL verbatim in 7.x.
//
// Use mainnet II even from local dev: pocket-ic (icp-cli >= 0.2.4) trusts
// mainnet subnet signatures. Override to http://id.ai.localhost:8000/authorize
// only if you have `ii: true` in icp.yaml and want fully-offline dev.
const authClient = new AuthClient({
  identityProvider: "https://id.ai/authorize",
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

#### Available attribute keys

`requestAttributes({ keys, nonce })` requires both `keys` and `nonce`: there is no default key set, you must pass an explicit list. The keys II currently accepts are:

| Key | What it IS | When to use |
|---|---|---|
| `name` | The user's display name from the II-linked account. | Personalisation in the UI. |
| `email` | The raw email string from the user's II-linked account. **II does not check it.** Treat as user-supplied input. | Mailing-list signups, contact email, anything where you don't gate access on the email. |
| `verified_email` | The same email as `email`, but only present when the source OpenID provider (e.g., Google) marked it as verified and II surfaced that signal. **The provider's verification is what makes it trustworthy.** | Access gating (e.g. an admin allowlist by email). Treat this as the only trustworthy email for authorisation. |

Request both `email` and `verified_email` if you want fallback behaviour: when the source provider marked the email as verified, both keys are present with the same value; when it didn't, only `email` is returned.

`scopedKeys({ openIdProvider, keys? })` rewrites the keys above into provider-scoped keys of the form `openid:<provider-url>:<key>`, so II returns the values from the linked OpenID account directly (with implicit consent, no extra prompt). Provider URLs:

| Provider | URL prefix in the bundle keys |
|---|---|
| `'google'` | `openid:https://accounts.google.com:` |
| `'apple'` | `openid:https://appleid.apple.com:` |
| `'microsoft'` | `openid:https://login.microsoftonline.com/{tid}/v2.0:` (the `{tid}` part is literal: do not substitute a tenant ID into it) |

The `keys` argument to `scopedKeys` is optional and defaults to `['name', 'email', 'verified_email']`. (`requestAttributes` itself has no default; the `scopedKeys` helper just builds the array you then pass to it.) Examples:

- `scopedKeys({ openIdProvider: 'google' })` &rarr; `['openid:https://accounts.google.com:name', 'openid:https://accounts.google.com:email', 'openid:https://accounts.google.com:verified_email']`
- `scopedKeys({ openIdProvider: 'google', keys: ['email'] })` &rarr; `['openid:https://accounts.google.com:email']`

The same `email` vs `verified_email` rule applies to scoped keys: use the verified variant when the email gates access.

```javascript
import { AuthClient } from "@icp-sdk/auth/client";
import { AttributesIdentity } from "@icp-sdk/core/identity";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

async function registerWithEmail(authClient, backendCanisterId, backendIdl, appCanisterId, appIdl) {
  // 1. The backend issues a nonce scoped to this registration.
  //    Frontend-generated nonces defeat replay protection — see Mistake #9.
  const anonymousAgent = await HttpAgent.create();
  const backend = Actor.createActor(backendIdl, {
    agent: anonymousAgent,
    canisterId: backendCanisterId,
  });
  const nonce = await backend.registerBegin();

  // 2. Run sign-in and the attribute request in parallel; the user sees
  //    a single Internet Identity interaction. Pass the same maxTimeToLive
  //    you use elsewhere so the delegation lifetime stays consistent.
  const signInPromise = authClient.signIn({
    maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000), // 8 hours in nanoseconds
  });
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

For OpenID one-click sign-in, attributes can be scoped to the provider via the `scopedKeys` helper. Authentication and attribute sharing happen in a single step (no extra prompt). The rest of the flow (await the promises, wrap with `AttributesIdentity`, call the protected method) is identical to `registerWithEmail` above:

```javascript
import { AuthClient, scopedKeys } from "@icp-sdk/auth/client";
import { AttributesIdentity } from "@icp-sdk/core/identity";
import { HttpAgent, Actor } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

const authClient = new AuthClient({
  identityProvider: "https://id.ai/authorize",
  openIdProvider: "google",
});

// Wrap the flow in an async function so this code works with any bundler
// target (Vite defaults to es2020 which lacks top-level await).
async function registerWithGoogle(backend, appCanisterId, appIdl) {
  const nonce = await backend.registerBegin();

  const signInPromise = authClient.signIn({
    maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000),
  });
  // Requests name, email, and verified_email from the Google account
  // linked to the user's Internet Identity. The keys returned by
  // scopedKeys() arrive in the bundle as e.g.
  // "openid:https://accounts.google.com:email".
  const attributesPromise = authClient.requestAttributes({
    keys: scopedKeys({ openIdProvider: "google" }),
    nonce,
  });

  const identity = await signInPromise;
  const { data, signature } = await attributesPromise;

  const identityWithAttributes = new AttributesIdentity({
    inner: identity,
    attributes: { data, signature },
    signer: { canisterId: Principal.fromText("rdmx6-jaaaa-aaaaa-aaadq-cai") },
  });

  const agent = await HttpAgent.create({ identity: identityWithAttributes });
  const app = Actor.createActor(appIdl, { agent, canisterId: appCanisterId });
  await app.registerFinish();
}
```

### Backend: Reading Identity Attributes

When the frontend wraps an identity with `AttributesIdentity`, every call carries a verified attribute bundle.

- **Rust** (ic-cdk >= 0.20.1): `ic_cdk::api::msg_caller_info_data() -> Vec<u8>`, `ic_cdk::api::msg_caller_info_signer() -> Option<Principal>`. There is no CDK wrapper for the trusted-signer check yet; do it explicitly in your code.
- **Motoko** (mo:core >= 2.5.0): `CallerAttributes.getAttributes<system>() : ?Blob` from `mo:core/CallerAttributes`. The wrapper returns `null` when no attributes are attached and **traps** when the signer isn't listed in the canister's `trusted_attribute_signers` env var, so you don't write the signer check yourself. Underlying primitives `Prim.callerInfoData<system>` / `Prim.callerInfoSigner<system>` are still exposed by the compiler but the wrapper is preferred.

**Always verify the signer.** The IC checks that the bundle is signed; it does not check *who* signed it. Any canister can produce a valid bundle. Trust the data only when the signer matches the trusted issuer (`rdmx6-jaaaa-aaaaa-aaadq-cai` for Internet Identity). Motoko handles this for you via the env var; Rust requires an explicit `msg_caller_info_signer()` check.

#### Configuring `trusted_attribute_signers` (Motoko path)

`CallerAttributes.getAttributes` reads the trusted signer list from the canister's `trusted_attribute_signers` environment variable (a comma-separated list of principal texts). Set it in your `icp.yaml` so `icp deploy` configures the canister automatically:

```yaml
canisters:
  - name: backend
    settings:
      environment_variables:
        # Mainnet II principal. List both the mainnet principal and your local II
        # canister principal if your tests run against a locally deployed II.
        trusted_attribute_signers: "rdmx6-jaaaa-aaaaa-aaadq-cai"
```

If the env var is unset, `getAttributes` traps with `"trusted_attribute_signers environment variable is not set"`. That trap is the right behavior: an unconfigured canister should not trust attribute bundles.

#### Reading the bundle

The data is Candid-encoded as an ICRC-3 `Value::Map` whose entries are:
- `implicit:nonce` (Blob) — must match a nonce your canister minted for this user/action.
- `implicit:origin` (Text) — must match a trusted frontend origin.
- `implicit:issued_at_timestamp_ns` (Nat) — reject if outside your freshness window.
- Plain attribute keys (e.g., `"email"`) for default-scope attributes.
- OpenID-scoped keys (e.g., `"openid:https://accounts.google.com:email"`) when `scopedKeys` was used on the frontend.

```motoko
import CallerAttributes "mo:core/CallerAttributes";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Time "mo:core/Time";

persistent actor {
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

  func lookupBlob(entries : [(Text, Icrc3Value)], key : Text) : ?Blob {
    for ((k, v) in entries.vals()) {
      if (k == key) { switch v { case (#Blob b) { return ?b }; case _ {} } };
    };
    null;
  };

  func lookupNat(entries : [(Text, Icrc3Value)], key : Text) : ?Nat {
    for ((k, v) in entries.vals()) {
      if (k == key) { switch v { case (#Nat n) { return ?n }; case _ {} } };
    };
    null;
  };

  // Pending nonces minted in registerBegin, keyed by caller. See the
  // "Storing the nonce" note below for storage patterns. Provided by
  // the canister's stable-memory state (e.g. a Map<Principal, Blob>).
  func consumePendingNonce(_caller : Principal) : ?Blob {
    // pendingNonces.remove(caller)
    Runtime.trap("see Storing the nonce");
  };

  // Returns the verified attribute map. Traps when the signer is not
  // listed in the canister's trusted_attribute_signers env var.
  func iiAttributes() : [(Text, Icrc3Value)] {
    let ?data = CallerAttributes.getAttributes<system>() else Runtime.trap("no trusted attributes");
    let ?value : ?Icrc3Value = from_candid (data) else Runtime.trap("invalid attribute bundle");
    let #Map(entries) = value else Runtime.trap("expected attribute map");
    entries
  };

  public shared ({ caller }) func registerFinish() : async Text {
    if (Principal.isAnonymous(caller)) Runtime.trap("Anonymous caller not allowed");
    let entries = iiAttributes();

    let ?origin = lookupText(entries, "implicit:origin") else Runtime.trap("missing origin");
    if (origin != "https://your-app.icp0.io") Runtime.trap("Wrong origin");

    // Verify implicit:nonce matches a nonce we minted for this caller, and consume it.
    let ?nonce = lookupBlob(entries, "implicit:nonce") else Runtime.trap("missing nonce");
    let ?expected = consumePendingNonce(caller) else Runtime.trap("no pending registration for caller");
    if (nonce != expected) Runtime.trap("Nonce mismatch");

    // Verify implicit:issued_at_timestamp_ns is within a 5-minute freshness window.
    // Time.now() is Int (nanoseconds); Nat <: Int so the comparison works directly.
    let ?issuedAt = lookupNat(entries, "implicit:issued_at_timestamp_ns") else Runtime.trap("missing timestamp");
    if (Time.now() > issuedAt + 300_000_000_000) Runtime.trap("Bundle too old");

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

fn lookup_blob<'a>(entries: &'a [(String, Icrc3Value)], key: &str) -> Option<&'a [u8]> {
    entries.iter().find_map(|(k, v)| match v {
        Icrc3Value::Blob(b) if k == key => Some(b.as_slice()),
        _ => None,
    })
}

fn lookup_nat<'a>(entries: &'a [(String, Icrc3Value)], key: &str) -> Option<&'a candid::Nat> {
    entries.iter().find_map(|(k, v)| match v {
        Icrc3Value::Nat(n) if k == key => Some(n),
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

// Pending nonces minted in register_begin, keyed by caller. See the
// "Storing the nonce" note below for storage patterns. Provided by
// the canister's stable-memory state (e.g. a StableBTreeMap).
fn consume_pending_nonce(_caller: Principal) -> Option<Vec<u8>> {
    // pendingNonces.remove(&caller)
    unimplemented!("see Storing the nonce")
}

#[update]
fn register_finish() -> String {
    let caller = msg_caller();
    if caller == Principal::anonymous() { ic_cdk::trap("Anonymous caller not allowed"); }
    let entries = ii_attributes();

    let origin = lookup_text(&entries, "implicit:origin")
        .unwrap_or_else(|| ic_cdk::trap("missing origin"));
    if origin != "https://your-app.icp0.io" { ic_cdk::trap("Wrong origin"); }

    // Verify implicit:nonce matches a nonce we minted for this caller, and consume it.
    let nonce = lookup_blob(&entries, "implicit:nonce")
        .unwrap_or_else(|| ic_cdk::trap("missing nonce"));
    let expected = consume_pending_nonce(caller)
        .unwrap_or_else(|| ic_cdk::trap("no pending registration for caller"));
    if nonce != expected.as_slice() { ic_cdk::trap("Nonce mismatch"); }

    // Verify implicit:issued_at_timestamp_ns is within a 5-minute freshness window.
    let issued_at_ns: u64 = lookup_nat(&entries, "implicit:issued_at_timestamp_ns")
        .unwrap_or_else(|| ic_cdk::trap("missing timestamp"))
        .0.clone().try_into()
        .unwrap_or_else(|_| ic_cdk::trap("timestamp out of range"));
    if ic_cdk::api::time() > issued_at_ns + 300_000_000_000 {
        ic_cdk::trap("Bundle too old");
    }

    let email = lookup_text(&entries, "email")
        .unwrap_or_else(|| ic_cdk::trap("missing email"));
    format!("Registered {} with email {}", caller, email)
}
```

**Storing the nonce:** mint it in `registerBegin` (or equivalent), persist it in stable memory keyed by the user's principal and the action name, and mark it consumed in `registerFinish` so a bundle cannot be replayed. Use a short freshness window so abandoned attempts age out. See the **stable-memory** skill for storage patterns.

### Backend: Access Control

Backend access control (anonymous principal rejection, role guards, caller binding in async functions) is not II-specific — the same patterns apply regardless of authentication method. See the **canister-security** skill for complete Motoko and Rust examples.

## 5.x API notes

If you are pinned to `@icp-sdk/auth` 5.x, the same flow uses a different (callback-based) API:

- `await AuthClient.create({...})` instead of `new AuthClient({...})`
- `identityProvider` passed per-call to `login({...})` rather than at construction
- `authClient.login({ onSuccess, onError })` — promise wrapper required around it
- `authClient.logout()` instead of `authClient.signOut()`
- `await authClient.isAuthenticated()` (async) instead of sync
- `authClient.getIdentity()` (sync) instead of async
- 5.x auto-appends `/authorize` to the `identityProvider` URL, so you can pass just `https://id.ai`. In 7.x the path is required.
- No `requestAttributes` / `AttributesIdentity` support — the identity-attributes flow above requires 7.x.

Upgrade to 7.x when you can — the promise-based API is harder to misuse and the callback variant has been removed.
