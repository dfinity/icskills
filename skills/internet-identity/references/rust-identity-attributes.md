# Rust backend for identity attributes

There is no CDK wrapper yet (`ic-cdk >= 0.20.1`), so a Rust canister implements the two methods the frontend calls by hand. `_internet_identity_sign_in_start` mints a nonce and stores it; `_internet_identity_sign_in_finish` checks the signer with `msg_caller_info_signer()`, decodes the ICRC-3 `Value::Map` from `msg_caller_info_data()`, and verifies origin, freshness, and the nonce before reading attributes. This mirrors what the Motoko `mo:identity-attributes` mixin does internally.

The bundle's entries:

- `implicit:nonce` (Blob): must match a nonce this canister minted and has not consumed.
- `implicit:origin` (Text): must match a trusted frontend origin.
- `implicit:issued_at_timestamp_ns` (Nat): reject when outside the freshness window.
- The keys the frontend requested: plain (`"verified_email"`, `"name"`), OpenID-scoped (`"openid:https://accounts.google.com:verified_email"`), or SSO-scoped (`"sso:<domain>:email"`, `"sso:<domain>:name"`). There is no `verified_email` under `sso:`.

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

    // Your app logic. verified_email gates access (see the email vs verified_email pitfall).
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

To accept an organization's SSO sign-ins, read `sso:<domain>:email` for each domain you trust instead of `verified_email`. That value is asserted by the organization's own identity provider, so trust it only for domains you list (the Motoko mixin's equivalent is `trusted_sso_domains`).
