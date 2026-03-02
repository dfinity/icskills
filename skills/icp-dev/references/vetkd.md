# vetKeys (Verifiable Encrypted Threshold Keys)

vetKeys bring on-chain privacy to the IC via the vetKD protocol: secure, on-demand key derivation so that a public blockchain can hold and work with secret data. Keys are verifiable, encrypted under a user-supplied transport key, and threshold-derived by a quorum of subnet nodes. This unlocks decentralized key management, encrypted on-chain storage, private messaging, identity-based encryption (IBE), and more.

> **Note:** The `ic-vetkeys` Rust crate and `@dfinity/vetkeys` npm package are published, but the APIs may still change. Pin your dependency versions.

## Canister IDs

| Canister | ID | Purpose |
|----------|-----|---------|
| Management Canister | `aaaaa-aa` | Exposes `vetkd_public_key` and `vetkd_derive_key` system APIs |
| Chain-key testing canister | `vrqyr-saaaa-aaaan-qzn4q-cai` | **Testing only:** fake vetKD implementation. Use key name `insecure_test_key_1`. Insecure, do not use in production. |

### Master Key Names and API Fees

| Key name       | Environment | Cycles (approx.)   |
|----------------|-------------|---------------------|
| `dfx_test_key` | Local       | --                  |
| `test_key_1`   | Mainnet     | 10_000_000_000      |
| `key_1`        | Mainnet     | 26_153_846_153      |

## Mistakes That Break Your Build

1. **Not pinning dependency versions.** The `ic-vetkeys` crate and `@dfinity/vetkeys` npm package are published, but the APIs may still change in new releases. Pin your versions and re-test after upgrades.

2. **Reusing transport keys across sessions.** Each session must generate a fresh transport key pair. The Rust and TypeScript libraries include support for generating keys safely; use them if at all possible.

3. **Using raw `vetkd_derive_key` output as an encryption key.** The output is an encrypted blob. You must decrypt it with the transport secret to get the vetKey. Then derive a symmetric key (e.g. via `toDerivedKeyMaterial()`) for AES. Do not use the decrypted bytes directly as an AES key.

4. **Confusing vetKD with traditional public-key crypto.** There are no static key pairs per user. Keys are derived on-demand from the subnet's threshold master key. The same (canister, context, input) always yields the same derived key.

5. **Putting secret data in the `input` field.** The input is sent to the management canister in plaintext. It is a key identifier, not encrypted payload. Use it for IDs (principal, document ID), never for the actual secret data.

6. **Forgetting that `vetkd_derive_key` is an async inter-canister call.** It costs cycles and requires `await`. Capture `caller` before the await as defensive practice.

7. **Using `context` inconsistently.** If the backend uses `b"my_app_v1"` as context but the frontend verification uses `b"my_app"`, the derived keys will not match and decryption will silently fail.

8. **Not attaching enough cycles to `vetkd_derive_key`.** `vetkd_derive_key` consumes cycles; `vetkd_public_key` does not. For derive_key, `key_1` costs ~26B cycles and `test_key_1` costs ~10B cycles.

## Key Patterns

### Rust

```rust
use candid::Principal;
use ic_cdk::update;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::DefaultMemoryImpl;
use ic_vetkeys::key_manager::KeyManager;
use ic_vetkeys::types::{AccessRights, VetKDCurve, VetKDKeyId};

thread_local! {
    static MEMORY_MANAGER: std::cell::RefCell<MemoryManager<DefaultMemoryImpl>> =
        std::cell::RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    static KEY_MANAGER: std::cell::RefCell<Option<KeyManager<AccessRights>>> =
        std::cell::RefCell::new(None);
}

#[ic_cdk::init]
fn init() {
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12381G2,
        name: "key_1".to_string(), // "dfx_test_key" for local, "test_key_1" for testing
    };
    MEMORY_MANAGER.with(|mm| {
        let mm = mm.borrow();
        KEY_MANAGER.with(|km| {
            *km.borrow_mut() = Some(KeyManager::init(
                "my_app_v1",              // domain separator (context)
                key_id,
                mm.get(MemoryId::new(0)),
                mm.get(MemoryId::new(1)),
                mm.get(MemoryId::new(2)),
            ));
        });
    });
}

#[update]
async fn get_encrypted_vetkey(subkey_id: Vec<u8>, transport_public_key: Vec<u8>) -> Vec<u8> {
    let caller = ic_cdk::caller(); // Capture BEFORE await
    let future = KEY_MANAGER.with(|km| {
        let km = km.borrow();
        let km = km.as_ref().expect("not initialized");
        km.get_encrypted_vetkey(caller, subkey_id, transport_public_key)
            .expect("access denied")
    });
    future.await
}
```

### Motoko

```motoko
import Blob "mo:core/Blob";
import Principal "mo:core/Principal";
import Text "mo:core/Text";

persistent actor {
  type VetKdCurve = { #bls12_381_g2 };
  type VetKdKeyId = { curve : VetKdCurve; name : Text };
  type VetKdPublicKeyRequest = { canister_id : ?Principal; context : Blob; key_id : VetKdKeyId };
  type VetKdPublicKeyResponse = { public_key : Blob };
  type VetKdDeriveKeyRequest = { input : Blob; context : Blob; transport_public_key : Blob; key_id : VetKdKeyId };
  type VetKdDeriveKeyResponse = { encrypted_key : Blob };

  let managementCanister : actor {
    vetkd_public_key : VetKdPublicKeyRequest -> async VetKdPublicKeyResponse;
    vetkd_derive_key : VetKdDeriveKeyRequest -> async VetKdDeriveKeyResponse;
  } = actor "aaaaa-aa";

  let context : Blob = Text.encodeUtf8("my_app_v1");

  // Key names: "dfx_test_key" for local, "test_key_1" for mainnet testing, "key_1" for production
  func keyId() : VetKdKeyId { { curve = #bls12_381_g2; name = "key_1" } };

  public shared ({ caller }) func deriveKey(transportPublicKey : Blob) : async Blob {
    // caller is captured here, before the await. vetkd_derive_key requires cycles.
    let response = await (with cycles = 26_000_000_000) managementCanister.vetkd_derive_key({
      input = Principal.toBlob(caller);
      context;
      transport_public_key = transportPublicKey;
      key_id = keyId();
    });
    response.encrypted_key
  };
};
```
