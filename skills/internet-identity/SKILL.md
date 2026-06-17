---
name: internet-identity
description: "Integrate Internet Identity authentication. Covers passkey and OpenID sign-in flows, delegation handling, and principal-per-app isolation. Use when adding sign-in, login, auth, passkeys, or Internet Identity to a frontend or canister. Do NOT use for wallet integration or ICRC signer flows — use wallet-integration instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.4, Node.js >= 22, moc >= 1.6.0"
metadata:
  title: Internet Identity
  category: Auth
---

# Internet Identity Authentication

## What This Is

Internet Identity (II) is the Internet Computer's native authentication system. Users authenticate into II-powered apps either with passkeys stored in their devices or through OpenID accounts (e.g., Google, Apple, Microsoft) -- no usernames or passwords required. Each user gets a unique principal per app, preventing cross-app tracking.

## Prerequisites

- `@icp-sdk/auth` (>= 7.0.0), `@icp-sdk/core` (>= 5.3.0) (`AttributesIdentity` was added in core v5.3.0)
- For the Motoko backend example: `mo:identity-attributes` >= 0.4.0 (mops) — the mixin that injects the two sign-in methods and verifies the bundle for you. It pulls in `mo:core` >= 2.5.0 and requires `moc` >= 1.6.0 for the `include` mixin.

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

9. **Generating the attribute nonce on the frontend.** The nonce passed to `requestAttributes` MUST come from a backend canister call. A frontend-generated nonce defeats replay protection: the canister cannot verify that the bundle's `implicit:nonce` is one it actually issued. Have the backend mint and return the nonce from `_internet_identity_sign_in_start` (the `mo:identity-attributes` mixin provides it in Motoko; you write it in Rust), and check it against the bundle's implicit fields when the user calls `_internet_identity_sign_in_finish`.

10. **Reading attribute data without verifying the signer.** The IC verifies the signature, not the identity of the signer — any canister can produce a valid bundle. The trusted signer is `rdmx6-jaaaa-aaaaa-aaadq-cai` (Internet Identity). The check looks different per language:
    - **Motoko**: use the `mo:identity-attributes` mixin. `include IdentityAttributes({ onVerified })` verifies the signer, origin, nonce, and freshness for you and runs `onVerified` only on a bundle that passes — configure `trusted_attribute_signers` and `frontend_origins` in `icp.yaml` (see "Backend: Reading Identity Attributes"). Don't hand-roll the ICRC-3 decode or the signer check on top of `mo:core/CallerAttributes` unless you need behavior the library doesn't cover.
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

When the backend needs more than the user's principal (e.g., a verified email), Internet Identity can return signed attributes alongside the delegation. The flow is a two-method handshake on the backend: `_internet_identity_sign_in_start` mints a nonce, and `_internet_identity_sign_in_finish` verifies the bundle. In Motoko the `mo:identity-attributes` mixin provides both methods; in Rust you implement them by hand (see "Backend: Reading Identity Attributes"). The frontend below is identical against either backend.

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

const II_PRINCIPAL = "rdmx6-jaaaa-aaaaa-aaadq-cai";

// `idl` and `canisterId` are your backend's interface factory and ID. The
// backend exposes _internet_identity_sign_in_start / _internet_identity_sign_in_finish.
async function signInWithAttributes(authClient, canisterId, idl) {
  // Anonymous handle, used only to mint the nonce.
  const anonymousAgent = await HttpAgent.create();
  const anonymousActor = Actor.createActor(idl, { agent: anonymousAgent, canisterId });

  // Mint the nonce, sign in, and request attributes in parallel. Passing the
  // nonce as a promise lets requestAttributes start before it resolves, so the
  // user still sees a single Internet Identity interaction. A frontend-generated
  // nonce would defeat replay protection — see Mistake #9.
  const noncePromise = anonymousActor._internet_identity_sign_in_start();
  const signInPromise = authClient.signIn({
    maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000), // 8 hours in nanoseconds
  });
  const attributesPromise = authClient.requestAttributes({
    keys: ["name", "verified_email"], // library reads verified_email for its email field
    nonce: noncePromise,
  });

  const identity = await signInPromise;
  const attributes = await attributesPromise;

  // Wrap the identity so the signed bundle travels as sender_info on each call.
  const verifiedAgent = await HttpAgent.create({
    identity: new AttributesIdentity({
      inner: identity,
      attributes,
      // The Internet Identity backend canister is the trusted attribute signer.
      signer: { canisterId: Principal.fromText(II_PRINCIPAL) },
    }),
  });
  const verifiedActor = Actor.createActor(idl, { agent: verifiedAgent, canisterId });

  // The backend verifies signer, origin, nonce, and freshness, then runs its
  // onVerified logic. Returns { ok } on success, { err } otherwise.
  const result = await verifiedActor._internet_identity_sign_in_finish();
  if ("err" in result) {
    throw new Error(`Attribute verification failed: ${JSON.stringify(result.err)}`);
  }
  return identity;
}
```

Each signed bundle carries three implicit fields the backend MUST verify:
- `implicit:nonce` — matches a single-use nonce the canister issued and consumes on sign-in, so a captured bundle cannot be replayed.
- `implicit:origin` — the frontend origin, preventing a malicious dapp from forwarding bundles to a different backend.
- `implicit:issued_at_timestamp_ns` — issuance time, letting the canister reject stale bundles even when the nonce is still valid.

For OpenID one-click sign-in, scope the attributes to the provider with the `scopedKeys` helper: authentication and attribute sharing happen in a single step (no extra prompt). Construct the client with `openIdProvider`, then swap the `keys` for the scoped forms. The rest of `signInWithAttributes` above is unchanged.

```javascript
import { AuthClient, scopedKeys } from "@icp-sdk/auth/client";

const authClient = new AuthClient({
  identityProvider: "https://id.ai/authorize",
  openIdProvider: "google",
});

// In signInWithAttributes, request the Google-scoped keys instead. They arrive
// in the bundle as e.g. "openid:https://accounts.google.com:verified_email",
// and the mo:identity-attributes library maps them onto the same name/email fields.
const attributesPromise = authClient.requestAttributes({
  keys: scopedKeys({ openIdProvider: "google", keys: ["name", "verified_email"] }),
  nonce: noncePromise,
});
```

### Backend: Reading Identity Attributes

The backend exposes two methods the frontend calls: `_internet_identity_sign_in_start` (mints a nonce) and `_internet_identity_sign_in_finish` (verifies the wrapped bundle and runs your logic). The checks are the same in both languages — the bundle must be signed by a *trusted* signer, its `implicit:origin` must be one you allow, its `implicit:issued_at_timestamp_ns` must be fresh, and its `implicit:nonce` must be one you issued and have not consumed — but Motoko gets them from a library and Rust does them by hand.

**Always verify the signer.** The IC checks that the bundle is signed; it does not check *who* signed it. Any canister can produce a valid bundle. The trusted signer for II is `rdmx6-jaaaa-aaaaa-aaadq-cai`.

#### Motoko: the `mo:identity-attributes` mixin

Add the library to `mops.toml`:

```toml
[dependencies]
identity-attributes = "0.4.1"
core                = "2.5.0"

[toolchain]
moc = "1.6.0"
```

`include IdentityAttributes({ onVerified })` injects both sign-in methods and runs your `onVerified` callback only on a bundle that passes every check. It resolves the bundle to `{ name : ?Text; email : ?Text; sso : ?Text }` — `email` comes from the `verified_email` key (or its `openid:` / `sso:` scoped form), which is why the frontend requests `verified_email`. `sso` is the matched trusted domain when name/email came from `sso:` keys, otherwise `null`.

```motoko
import IdentityAttributes "mo:identity-attributes";
import Map "mo:core/Map";
import Principal "mo:core/Principal";

persistent actor {
  type Profile = { name : ?Text; email : ?Text; sso : ?Text };

  let profiles = Map.empty<Principal, Profile>();

  // Injects _internet_identity_sign_in_start / _internet_identity_sign_in_finish.
  // onVerified runs only on a bundle that passed the signer, origin, nonce, and
  // freshness checks.
  include IdentityAttributes({
    onVerified = func(caller, attrs) {
      profiles.add(caller, attrs);
    };
  });

  public query func getProfile(caller : Principal) : async ?Profile {
    profiles.get(caller)
  };
};
```

Configure the env vars in `icp.yaml` so `icp deploy` sets them on the canister:

```yaml
canisters:
  - name: backend
    settings:
      environment_variables:
        # II backend principal (required). List your local II principal too if tests run against it.
        trusted_attribute_signers: "rdmx6-jaaaa-aaaaa-aaadq-cai"
        # Allowed frontend origins, comma-separated (required).
        frontend_origins: "https://your-app.icp.net"
        # Trusted SSO domains, comma-separated (optional; omit to reject all sso:* keys).
        trusted_sso_domains: "your-org.com"
```

If `trusted_attribute_signers` is unset the bundle is rejected as untrusted; if `frontend_origins` is unset `_internet_identity_sign_in_finish` returns `#err(#FrontendOriginsNotConfigured)`. Both are the right behavior: an unconfigured canister must not trust attribute bundles. The method returns `Result<(), IdentityAttributesError>`; the error variants (`#NoAttributes`, `#MalformedCandid`, `#FrontendOriginMismatch`, `#Stale`, `#UnknownNonce`, `#AmbiguousAttribute`, `#UntrustedSsoSource`, `#MixedSsoSources`) tell the frontend whether to retry with a fresh nonce or surface a bug.

#### Rust: implement the same two methods by hand

There is no CDK wrapper yet (`ic-cdk >= 0.20.1`), so write the two methods yourself. `_internet_identity_sign_in_start` mints a nonce and stores it; `_internet_identity_sign_in_finish` checks the signer with `msg_caller_info_signer()`, decodes the ICRC-3 `Value::Map` from `msg_caller_info_data()`, and verifies origin, freshness, and the nonce before reading attributes. This mirrors what the Motoko library does internally. The bundle's entries are:

- `implicit:nonce` (Blob) — must match a nonce this canister minted and not yet consumed.
- `implicit:origin` (Text) — must match a trusted frontend origin.
- `implicit:issued_at_timestamp_ns` (Nat) — reject if outside your freshness window.
- The attribute keys you requested (e.g. `"verified_email"`, or the `openid:` / `sso:` scoped form).

```rust
use candid::{decode_one, CandidType, Deserialize, Principal};
use ic_cdk::api::{msg_caller, msg_caller_info_data, msg_caller_info_signer, time};
use ic_cdk::update;
use std::cell::RefCell;
use std::collections::HashSet;

const II_PRINCIPAL: &str = "rdmx6-jaaaa-aaaaa-aaadq-cai";
const TRUSTED_ORIGIN: &str = "https://your-app.icp.net";
const FRESHNESS_NS: u64 = 300_000_000_000; // 5 minutes

thread_local! {
    // Nonces issued by sign_in_start and consumed by sign_in_finish.
    static PENDING_NONCES: RefCell<HashSet<Vec<u8>>> = RefCell::new(HashSet::new());
}

// Mirrors the mo:identity-attributes Result so the frontend's `"err" in result`
// check works against either backend.
#[derive(CandidType)]
enum SignInResult {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "err")]
    Err(String),
}

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

// Mint a fresh nonce. The frontend calls this anonymously before sign-in.
#[update]
async fn _internet_identity_sign_in_start() -> Vec<u8> {
    let nonce = ic_cdk::management_canister::raw_rand()
        .await
        .expect("raw_rand failed");
    PENDING_NONCES.with_borrow_mut(|n| n.insert(nonce.clone()));
    nonce
}

// Runs every check the mo:identity-attributes mixin runs internally.
fn verified_attributes() -> Result<Vec<(String, Icrc3Value)>, String> {
    // 1. Trusted signer: the IC checks the signature, not who signed it.
    let trusted = Principal::from_text(II_PRINCIPAL).unwrap();
    if msg_caller_info_signer() != Some(trusted) {
        return Err("Untrusted attribute signer".to_string());
    }

    // 2. Decode the bundle as an ICRC-3 Value::Map.
    let value: Icrc3Value =
        decode_one(&msg_caller_info_data()).map_err(|_| "Malformed attribute bundle".to_string())?;
    let Icrc3Value::Map(entries) = value else {
        return Err("Expected attribute map".to_string());
    };

    // 3. Origin must be one we allow.
    let origin = lookup_text(&entries, "implicit:origin").ok_or("Missing origin")?;
    if origin != TRUSTED_ORIGIN {
        return Err(format!("Untrusted frontend origin: {origin}"));
    }

    // 4. Bundle must be fresh.
    let issued_at: u64 = lookup_nat(&entries, "implicit:issued_at_timestamp_ns")
        .ok_or("Missing timestamp")?
        .0
        .clone()
        .try_into()
        .map_err(|_| "Timestamp out of range".to_string())?;
    if time() > issued_at + FRESHNESS_NS {
        return Err("Bundle too old".to_string());
    }

    // 5. Nonce must be one we issued and have not consumed yet.
    let nonce = lookup_blob(&entries, "implicit:nonce").ok_or("Missing nonce")?;
    if !PENDING_NONCES.with_borrow_mut(|n| n.remove(nonce)) {
        return Err("Unknown or already-consumed nonce".to_string());
    }

    Ok(entries)
}

#[update]
fn _internet_identity_sign_in_finish() -> SignInResult {
    let entries = match verified_attributes() {
        Ok(entries) => entries,
        Err(e) => return SignInResult::Err(e),
    };

    // Your app logic. verified_email gates access — see Mistake #12.
    let Some(email) = lookup_text(&entries, "verified_email") else {
        return SignInResult::Err("Missing verified_email".to_string());
    };
    let caller = msg_caller();
    let name = lookup_text(&entries, "name");
    // e.g. persist a profile keyed by `caller` here.
    let _ = (caller, email, name);

    SignInResult::Ok
}
```

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
