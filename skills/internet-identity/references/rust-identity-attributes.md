# Rust backend for identity attributes

There is no CDK wrapper yet, so a Rust canister implements the two methods the frontend calls by hand, with `ic-cdk` 0.20.1 or later and `ic-cdk-management-canister`. `_internet_identity_sign_in_start` mints a nonce and stores it, dropping expired ones and refusing past a cap; `_internet_identity_sign_in_finish` checks the signer with `msg_caller_info_signer()`, decodes the ICRC-3 `Value::Map` from `msg_caller_info_data()`, and verifies origin, freshness, and the nonce before reading attributes. This mirrors what the Motoko `mo:identity-attributes` mixin does internally.

The bundle's entries:

- `implicit:nonce` (Blob): must match a nonce this canister minted and has not consumed.
- `implicit:origin` (Text): must match a trusted frontend origin.
- `implicit:issued_at_timestamp_ns` (Nat): reject when outside the freshness window.
- The keys the frontend requested: plain (`"verified_email"`, `"name"`), OpenID-scoped (`"openid:https://accounts.google.com:verified_email"`), or SSO-scoped (`"sso:<domain>:email"`, `"sso:<domain>:name"`). There is no `verified_email` under `sso:`.

```rust
use candid::{decode_one, CandidType, Deserialize, Nat, Principal};
use ic_cdk::api::{msg_caller, msg_caller_info_data, msg_caller_info_signer, time};
use ic_cdk::update;
use std::cell::RefCell;
use std::collections::HashMap;

const II_CANISTER_ID: &str = "rdmx6-jaaaa-aaaaa-aaadq-cai";
const TRUSTED_ORIGIN: &str = "https://your-app.icp.net";
const MAX_AGE_NS: u64 = 5 * 60 * 1_000_000_000;
const MAX_PENDING_NONCES: usize = 10_000;

thread_local! {
    static NONCES: RefCell<HashMap<Vec<u8>, u64>> = RefCell::new(HashMap::new());
}

#[derive(CandidType, Deserialize)]
enum Value {
    Nat(Nat),
    Int(candid::Int),
    Blob(Vec<u8>),
    Text(String),
    Array(Vec<Value>),
    Map(Vec<(String, Value)>),
}

#[derive(CandidType, Deserialize)]
enum SignInResult {
    #[serde(rename = "ok")]
    Ok,
    #[serde(rename = "err")]
    Err(String),
}

fn get<'a>(entries: &'a [(String, Value)], key: &str) -> Option<&'a Value> {
    entries.iter().find(|(k, _)| k == key).map(|(_, v)| v)
}

#[update]
async fn _internet_identity_sign_in_start() -> Vec<u8> {
    let nonce = ic_cdk_management_canister::raw_rand().await.expect("raw_rand failed");
    let now = time();
    NONCES.with_borrow_mut(|n| {
        n.retain(|_, issued| now - *issued < MAX_AGE_NS);
        if n.len() >= MAX_PENDING_NONCES {
            ic_cdk::trap("too many pending sign-ins");
        }
        n.insert(nonce.clone(), now);
    });
    nonce
}

fn verified_attributes() -> Result<Vec<(String, Value)>, String> {
    if msg_caller_info_signer() != Some(Principal::from_text(II_CANISTER_ID).unwrap()) {
        return Err("untrusted signer".into());
    }
    let Ok(Value::Map(entries)) = decode_one::<Value>(&msg_caller_info_data()) else {
        return Err("malformed bundle".into());
    };
    let Some(Value::Text(origin)) = get(&entries, "implicit:origin") else {
        return Err("missing origin".into());
    };
    if origin != TRUSTED_ORIGIN {
        return Err(format!("untrusted origin {origin}"));
    }
    let Some(Value::Nat(issued_at)) = get(&entries, "implicit:issued_at_timestamp_ns") else {
        return Err("missing timestamp".into());
    };
    let issued_at: u64 = issued_at.0.clone().try_into().map_err(|_| "bad timestamp")?;
    if time() > issued_at + MAX_AGE_NS {
        return Err("bundle too old".into());
    }
    let Some(Value::Blob(nonce)) = get(&entries, "implicit:nonce") else {
        return Err("missing nonce".into());
    };
    if NONCES.with_borrow_mut(|n| n.remove(nonce)).is_none() {
        return Err("unknown or consumed nonce".into());
    }
    Ok(entries)
}

#[update]
fn _internet_identity_sign_in_finish() -> SignInResult {
    let entries = match verified_attributes() {
        Ok(entries) => entries,
        Err(e) => return SignInResult::Err(e),
    };
    let Some(Value::Text(email)) = get(&entries, "verified_email") else {
        return SignInResult::Err("missing verified_email".into());
    };
    // Your logic: for example, store a profile for msg_caller() with this email.
    let _ = (msg_caller(), email);
    SignInResult::Ok
}
```

The `ok` / `err` result mirrors the Motoko mixin's, so the same frontend works against either backend.

To accept an organization's SSO sign-ins, read `sso:<domain>:email` for each domain you trust instead of `verified_email`. That value is asserted by the organization's own identity provider, so trust it only for domains you list (the Motoko mixin's equivalent is `trusted_sso_domains`). Reject a bundle that mixes `sso:` keys with keys of another source.
