---
name: vetkeys
description: "Advanced vetKeys primitives on the Internet Computer: BLS threshold signatures, Identity-Based Encryption (IBE), and timelock encryption. Use when building verifiable signatures, encrypted messaging where senders encrypt to a recipient's identity (no key exchange needed), sealed-bid auctions, time-locked secrets, or verifiable randomness (VRF). Do NOT use for encrypted key-value storage with access control (use encrypted-maps instead)."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2"
metadata:
  title: VetKeys
  category: Security
---

# VetKeys: BLS Signatures, IBE, and Timelock Encryption

## What This Is

VetKeys (Verifiably Encrypted Threshold Keys) is a threshold key derivation protocol on the Internet Computer. This skill covers three advanced primitives built on vetKeys:

- **BLS Signatures**: Threshold BLS12-381 signing. The canister signs messages using the `sign_with_bls` system API. The signing key is split among the subnet nodes and never fully reconstructed.
- **Identity-Based Encryption (IBE)**: Encrypt to a recipient's identity (e.g., their principal) without needing their public key first. The recipient later derives their decryption key from the IC.
- **Timelock Encryption**: A special case of IBE where the "identity" is a future event (e.g., timestamp or auction lot ID). Data stays encrypted until the canister derives the decryption key after the event occurs.

For encrypted key-value storage with access control and sharing, use the `encrypted-maps` skill instead — it provides a higher-level abstraction that handles all crypto internally.

Reference implementations: [vetkeys/examples](https://github.com/dfinity/vetkeys/tree/main/examples)

## Prerequisites

Verify: `icp --version` must be >= 0.2.2.

### Rust

```toml
# Cargo.toml
[dependencies]
candid = "0.10"
ic-cdk = "0.19.0"
ic-cdk-timers = "1.0.0"        # only needed for timelock (timer-based decryption)
ic-stable-structures = "0.7.0"
ic-vetkeys = "0.6.0"
ic-dummy-getrandom-for-wasm = "0.1.0"
serde = "1"
serde_bytes = "0.11"
serde_cbor = "0.11"
```

### Frontend

```json
{
  "dependencies": {
    "@dfinity/agent": "^3.4.0",
    "@dfinity/principal": "^3.4.0",
    "@dfinity/vetkeys": "^0.4.0"
  }
}
```

## Key Concepts

- **VetKD Key ID**: Every vetKeys operation references a key ID with a curve (`Bls12_381_G2`) and a name (`"test_key_1"` for testing, `"key_1"` for production). The key name is set at canister init.
- **Context (domain separator)**: A byte string that scopes key derivation per application. Different contexts produce different keys from the same master key. Always use a unique domain separator per app.
- **Input**: The derivation input determines *which* key is derived. For BLS signing this is the message. For IBE this is the recipient's identity. For timelock this is the event identifier.
- **Transport key**: For IBE, the encrypted vetKey is transported to the client using an ephemeral transport key pair. The `@dfinity/vetkeys` frontend library handles this automatically via `TransportSecretKey`.
- **Unencrypted vs encrypted vetKey**: BLS signatures and timelock encryption use *unencrypted* vetKeys (the canister derives them directly via `sign_with_bls`). IBE uses *encrypted* vetKeys (the client decrypts them locally to extract the private decryption key).
- **Cycle costs**: `vetkd_public_key` is free. `vetkd_derive_key` (and `sign_with_bls`) costs cycles: ~10B for `test_key_1` on mainnet, ~26B for `key_1` on mainnet. Locally, PocketIC (used by icp-cli) charges ~26B for any key name. The `ic-vetkeys` helpers attach cycles automatically. If your canister may be blackholed, send extra cycles — subnet size increases can raise costs; unused cycles are refunded.
- **Chain-key testing canister** (`vrqyr-saaaa-aaaan-qzn4q-cai`): A fake vetKD implementation deployed on mainnet for cheap integration testing. Uses key name `insecure_test_key_1`. No threshold security — **never use in production or with sensitive data**.
- **Offline public key derivation**: For IBE, you can derive a canister's public key entirely offline from the known mainnet master public key — no canister call needed. This means the sender can encrypt to a recipient's identity without the canister or recipient being online.

## Common Pitfalls

1. **Using raw `vetkd_derive_key` instead of `ic_vetkeys` helpers.** The `ic-vetkeys` crate provides `management_canister::sign_with_bls()` and `management_canister::bls_public_key()` which handle cycle attachment and the unencrypted transport key trick. Do not call `vetkd_derive_key` directly for BLS or timelock.

2. **Forgetting the domain separator in the context.** Without a domain separator, keys derived by a canister for a certain context could collide with keys derived by the same canister in a different context. Always prefix the context with a unique app identifier. For BLS signing, the context typically includes both the domain separator and the signer's principal.

3. **Using an encrypted vetKey for BLS signatures.** BLS signatures require the canister to see the key (it *is* the signature). Use `sign_with_bls` which derives an unencrypted vetKey. If you use `vetkd_derive_key` with a real transport key, you get an encrypted key which the canister has to decrypt before using it.

4. **Mixing up `input` and `context` for IBE vs BLS.** For BLS signing: `input` = message bytes, `context` = domain separator + signer identity. For IBE: `input` = recipient identity, `context` = domain separator. Getting these swapped means wrong keys and failed verification/decryption.

5. **Not handling `getrandom` for Wasm.** The `ic-vetkeys` crate depends on crates that use `getrandom`. Add `ic-dummy-getrandom-for-wasm = "0.1.0"` to your dependencies — it registers a custom `getrandom` implementation for the `wasm32-unknown-unknown` target.

## Implementation

### BLS Signatures (Rust Backend)

A canister that signs messages with threshold BLS and stores signatures for later verification.

```rust
// backend/src/lib.rs
use candid::Principal;
use ic_cdk::management_canister::{VetKDCurve, VetKDKeyId, VetKDPublicKeyArgs};
use ic_cdk::{init, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{Cell as StableCell, DefaultMemoryImpl, StableBTreeMap};
use serde_bytes::ByteBuf;
use std::cell::RefCell;

mod types;
use types::Signature;

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    static SIGNATURES: RefCell<StableBTreeMap<(Principal, u64), Signature, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with_borrow(|m| m.get(MemoryId::new(0))),
        ));
    static KEY_NAME: RefCell<StableCell<String, Memory>> =
        RefCell::new(StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            String::new(),
        ));
}

#[init]
fn init(key_name: String) {
    KEY_NAME.with_borrow_mut(|kn| kn.set(key_name));
}

#[update]
async fn sign_message(message: String) -> ByteBuf {
    let signer = ic_cdk::api::msg_caller();
    let signature_bytes = ic_vetkeys::management_canister::sign_with_bls(
        message.as_bytes().to_vec(),
        context(&signer),
        key_id(),
    )
    .await
    .expect("sign_with_bls failed");

    // Store the signature
    SIGNATURES.with_borrow_mut(|sigs| {
        let timestamp = ic_cdk::api::time();
        let sig = Signature {
            message,
            signature: signature_bytes.clone(),
            timestamp,
        };
        let mut ts = timestamp;
        while sigs.get(&(signer, ts)).is_some() {
            ts += 1; // handle same-round collisions
        }
        sigs.insert((signer, ts), sig);
    });

    ByteBuf::from(signature_bytes)
}

#[update]
async fn get_my_verification_key() -> ByteBuf {
    let request = VetKDPublicKeyArgs {
        canister_id: None,
        context: context(&ic_cdk::api::msg_caller()),
        key_id: key_id(),
    };
    let result = ic_cdk::management_canister::vetkd_public_key(&request)
        .await
        .expect("vetkd_public_key failed");
    ByteBuf::from(result.public_key)
}

#[query]
fn get_my_signatures() -> Vec<Signature> {
    let me = ic_cdk::api::msg_caller();
    SIGNATURES.with_borrow(|sigs| {
        sigs.range((me, 0)..)
            .take_while(|entry| entry.key().0 == me)
            .map(|entry| entry.value())
            .collect()
    })
}

fn context(signer: &Principal) -> Vec<u8> {
    const DOMAIN_SEPARATOR: &[u8] = b"my_bls_signing_dapp";
    let mut ctx = vec![DOMAIN_SEPARATOR.len() as u8];
    ctx.extend_from_slice(DOMAIN_SEPARATOR);
    ctx.extend_from_slice(signer.as_ref());
    ctx
}

fn key_id() -> VetKDKeyId {
    VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: KEY_NAME.with_borrow(|kn| kn.get().clone()),
    }
}

ic_cdk::export_candid!();
```

```rust
// backend/src/types.rs
use candid::CandidType;
use ic_stable_structures::{storable::Bound, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;

#[derive(CandidType, Serialize, Deserialize, Clone, Debug)]
pub struct Signature {
    pub message: String,
    #[serde(with = "serde_bytes")]
    pub signature: Vec<u8>,
    pub timestamp: u64,
}

impl Storable for Signature {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(serde_cbor::to_vec(self).expect("failed to serialize"))
    }
    fn into_bytes(self) -> Vec<u8> {
        serde_cbor::to_vec(&self).expect("failed to serialize")
    }
    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        serde_cbor::from_slice(&bytes).expect("failed to deserialize")
    }
    const BOUND: Bound = Bound::Unbounded;
}
```

### BLS Verification (Frontend)

```typescript
import { DerivedPublicKey, verifyBlsSignature } from "@dfinity/vetkeys";

// Get the public key from the canister
const pubKeyBytes = new Uint8Array(await backend.get_my_verification_key());
const publicKey = DerivedPublicKey.deserialize(pubKeyBytes);

// Sign a message via the canister
const message = new TextEncoder().encode("hello world");
const signatureBytes = new Uint8Array(await backend.sign_message("hello world"));

// Verify the signature (can be done anywhere — no canister call needed)
const isValid = verifyBlsSignature(publicKey, message, signatureBytes);
```

### IBE: Encrypted Messaging (Rust Backend)

The canister structure (init, `thread_local!`, `MemoryManager`, `key_id()`) is the same as the BLS example. Replace the BLS-specific endpoints with these IBE endpoints. The key differences: IBE uses `vetkd_public_key` and `vetkd_derive_key` directly (not `sign_with_bls`), and the context is just the domain separator (no signer principal).

```rust
const DOMAIN_SEPARATOR: &str = "my_ibe_messaging_dapp";

#[update]
async fn get_ibe_public_key() -> ByteBuf {
    let request = VetKDPublicKeyArgs {
        canister_id: None,
        context: DOMAIN_SEPARATOR.as_bytes().to_vec(),
        key_id: key_id(),
    };
    let result = ic_cdk::management_canister::vetkd_public_key(&request)
        .await
        .expect("vetkd_public_key failed");
    ByteBuf::from(result.public_key)
}

#[update]
async fn get_my_encrypted_ibe_key(transport_key: ByteBuf) -> ByteBuf {
    let caller = ic_cdk::api::msg_caller();
    let request = VetKDDeriveKeyArgs {
        input: caller.as_ref().to_vec(),         // recipient identity = caller's principal
        context: DOMAIN_SEPARATOR.as_bytes().to_vec(),
        key_id: key_id(),
        transport_public_key: transport_key.into_vec(),
    };
    let result = ic_cdk::management_canister::vetkd_derive_key(&request)
        .await
        .expect("vetkd_derive_key failed");
    ByteBuf::from(result.encrypted_key)
}

#[update]
fn send_message(request: SendMessageRequest) -> Result<(), String> {
    let sender = ic_cdk::api::msg_caller();
    let timestamp = ic_cdk::api::time();
    INBOXES.with_borrow_mut(|inboxes| {
        let mut inbox = inboxes.get(&request.receiver).unwrap_or_default();
        if inbox.messages.len() >= 1000 {
            return Err(format!("Inbox for {} is full", request.receiver));
        }
        inbox.messages.push(Message { sender, encrypted_message: request.encrypted_message, timestamp });
        inboxes.insert(request.receiver, inbox);
        Ok(())
    })
}
```

Storage uses `StableBTreeMap<Principal, Inbox, Memory>` where `Inbox` contains a `Vec<Message>`. Both implement `Storable` via `serde_cbor` (same pattern as `Signature` above).

### IBE: Encrypt and Decrypt (Frontend)

```typescript
import { Principal } from "@dfinity/principal";
import {
    TransportSecretKey,
    DerivedPublicKey,
    EncryptedVetKey,
    IbeCiphertext,
    IbeIdentity,
    IbeSeed,
} from "@dfinity/vetkeys";

// --- Encrypt a message to a recipient's principal ---
// 1. Get the IBE public key from the canister (cache this)
const pubKeyBytes = new Uint8Array(await backend.get_ibe_public_key());
const ibePublicKey = DerivedPublicKey.deserialize(pubKeyBytes);

// 2. Encrypt to the recipient's identity
const recipient = Principal.fromText("xxxxx-xxxxx-xxxxx-xxxxx-cai");
const plaintext = new TextEncoder().encode("secret message");

const ciphertext = IbeCiphertext.encrypt(
    ibePublicKey,
    IbeIdentity.fromPrincipal(recipient),
    plaintext,
    IbeSeed.random(),
);

// 3. Send the serialized ciphertext to the canister
await backend.send_message({
    receiver: recipient,
    encrypted_message: ciphertext.serialize(),
});

// --- Decrypt messages in your inbox ---
// 1. Generate a transport key pair
const transportSecretKey = TransportSecretKey.random();

// 2. Request your encrypted IBE private key from the canister
const encKeyBytes = new Uint8Array(
    await backend.get_my_encrypted_ibe_key(transportSecretKey.publicKeyBytes()),
);

// 3. Decrypt and verify the IBE private key locally
const myPrincipal = identity.getPrincipal();
const ibePrivateKey = EncryptedVetKey.deserialize(encKeyBytes).decryptAndVerify(
    transportSecretKey,
    ibePublicKey,
    new Uint8Array(myPrincipal.toUint8Array()),
);

// 4. Decrypt each message
const inbox = await backend.get_my_messages();
for (const msg of inbox.messages) {
    const ct = IbeCiphertext.deserialize(new Uint8Array(msg.encrypted_message));
    const decrypted = ct.decrypt(ibePrivateKey);
    console.log(new TextDecoder().decode(decrypted));
}
```

### Timelock Encryption

Timelock encryption uses IBE where the "identity" is an event identifier (e.g., auction lot ID). The canister derives the decryption key only after the event occurs — until then, no one can decrypt. Key difference from IBE messaging: the canister itself decrypts (unencrypted vetKey), not the client.

Pattern: client encrypts with `IbeCiphertext.encrypt()` using `IbeIdentity.fromBytes(lotId)` + IBE public key, sends ciphertext to canister. When the event occurs, the canister calls `vetkd_derive_key` with the event ID as input and decrypts all ciphertexts:

```rust
// Canister-side decryption after the event occurs (e.g., auction closes)
async fn decrypt_ciphertexts(
    identity: Vec<u8>,             // the event ID (e.g., lot_id.to_le_bytes())
    encrypted_values: Vec<&[u8]>,  // serialized IbeCiphertexts
) -> Vec<Result<Vec<u8>, String>> {
    // Use a dummy seed — the canister sees the key anyway (timelock pattern)
    let transport_secret_key = ic_vetkeys::TransportSecretKey::from_seed(vec![0; 32])
        .expect("failed to create transport secret key");

    let request = VetKDDeriveKeyArgs {
        context: DOMAIN_SEPARATOR.as_bytes().to_vec(),
        input: identity.clone(),
        key_id: key_id(),
        transport_public_key: transport_secret_key.public_key().to_vec(),
    };

    let result = ic_cdk::management_canister::vetkd_derive_key(&request)
        .await
        .expect("vetkd_derive_key failed");

    let ibe_public_key = DerivedPublicKey::deserialize(
        &get_ibe_public_key().await.into_vec(),
    ).unwrap();
    let encrypted_vetkey = EncryptedVetKey::deserialize(&result.encrypted_key).unwrap();

    let ibe_key = encrypted_vetkey
        .decrypt_and_verify(&transport_secret_key, &ibe_public_key, identity.as_ref())
        .expect("failed to decrypt ibe key");

    encrypted_values.iter().map(|ev| {
        ic_vetkeys::IbeCiphertext::deserialize(ev)
            .map_err(|e| format!("deserialize failed: {e}"))
            .and_then(|c| c.decrypt(&ibe_key).map_err(|_| "decrypt failed".to_string()))
    }).collect()
}
```

Register a timer in both `#[init]` and `#[post_upgrade]` to trigger decryption:

```rust
use ic_cdk_timers::set_timer_interval;
// Call from both init() and post_upgrade() — timers don't survive upgrades
set_timer_interval(std::time::Duration::from_secs(5), || close_expired_lots());
```

### Offline Public Key Derivation (IBE)

For IBE, you can derive the canister's public key entirely offline from the known mainnet master public key — no canister call needed.

**Rust:**

```rust
use ic_vetkeys::{MasterPublicKey, DerivedPublicKey};

// Start from the known mainnet master public key for key_1
let master_key = MasterPublicKey::for_mainnet_key("key_1")
    .expect("unknown key name");

// Derive the canister-level key, then the sub-key for your context
let derived_key: DerivedPublicKey = master_key
    .derive_canister_key(canister_id.as_slice())
    .derive_sub_key(b"my_ibe_messaging_dapp");

// Use derived_key for IBE encryption — no canister call needed
let ciphertext = IbeCiphertext::encrypt(
    &derived_key,
    &IbeIdentity::from_bytes(recipient_principal.as_slice()),
    plaintext,
    &IbeSeed::new(&mut rand::rng()),
);
```

**TypeScript:**

```typescript
import { MasterPublicKey } from "@dfinity/vetkeys";

// Start from the known mainnet master public key
const masterKey = MasterPublicKey.productionKey();

// Derive the canister-level key, then the sub-key for your context
const derivedKey = masterKey
    .deriveCanisterKey(canisterId)
    .deriveSubKey(new TextEncoder().encode("my_ibe_messaging_dapp"));

// Use derivedKey for IBE encryption — no canister call needed
const ciphertext = IbeCiphertext.encrypt(
    derivedKey,
    IbeIdentity.fromPrincipal(recipient),
    plaintext,
    IbeSeed.random(),
);
```

For local development (icp-cli uses PocketIC), the libraries ship hardcoded test keys:
- **Rust:** `MasterPublicKey::for_pocketic_key(&key_id)` — supports `key_1`, `test_key_1`, `dfx_test_key`
- **TypeScript:** `MasterPublicKey.pocketicKey(PocketIcMasterPublicKeyId.KEY_1)` — supports `KEY_1`, `TEST_KEY_1`, `DFX_TEST_KEY`

### icp.yaml

```yaml
canisters:
  - name: backend
    recipe:
      type: "@dfinity/rust@v3.2.0"
      configuration:
        package: my-vetkeys-backend
    init_args: '("test_key_1")'

  - name: frontend
    recipe:
      type: "@dfinity/asset-canister@v2.1.0"
      configuration:
        dir: frontend/dist
        build:
          - npm --prefix frontend install
          - npm --prefix frontend run build

networks:
  - name: local
    mode: managed
    ii: true
```

Change `init_args` to `'("key_1")'` for production. The `@dfinity/rust` recipe runs `cargo build --package <name>` from the project root, so you need a workspace `Cargo.toml` at the root:

```toml
# Cargo.toml (project root)
[workspace]
members = ["backend"]
resolver = "2"
```

## Deploy & Verify

```bash
icp network start -d
icp deploy backend

# BLS: sign a message — expected: non-empty blob (48 bytes)
icp canister call backend sign_message '("hello world")'

# BLS: get verification key — expected: non-empty blob (96+ bytes)
icp canister call backend get_my_verification_key '()'

# IBE: get public key — expected: non-empty blob (96+ bytes)
icp canister call backend get_ibe_public_key '()'

# Frontend: encrypt a message to a principal, login as that principal,
# decrypt — plaintext matches original
```