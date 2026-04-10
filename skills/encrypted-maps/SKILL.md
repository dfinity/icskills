---
name: encrypted-maps
description: "Build end-to-end encrypted on-chain storage using vetKeys EncryptedMaps. Provides encrypted key-value maps with access control and multi-user sharing. Use when building password managers, encrypted notes, secret vaults, config stores, or any app needing encrypted storage with user-controlled sharing on the Internet Computer. Do NOT use for authentication (use internet-identity), plain unencrypted storage (use stable-memory), or advanced vetKeys features like BLS signatures, IBE, or timelock encryption (use vetkeys)."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2"
metadata:
  title: Encrypted Maps
  category: Security
---

# Encrypted Maps (vetKeys)

## What This Is

EncryptedMaps is a high-level library built on vetKeys that provides end-to-end encrypted key-value storage on the Internet Computer. Data is encrypted and decrypted on the client — the canister only stores ciphertext. The `@dfinity/vetkeys` frontend library handles all cryptographic operations (transport keys, key derivation, AES-GCM) automatically. Maps support owner-controlled sharing with three access levels. Both Rust and Motoko backend libraries are available.

**Use this skill** for password managers, encrypted notes, secret vaults, config stores, or any app that needs encrypted storage with user-controlled sharing. **Use the `vetkeys` skill instead** for BLS threshold signatures, identity-based encryption (IBE), timelock encryption, or verifiable randomness — these are lower-level primitives where you control the cryptographic flow directly.

Reference implementation: [vetkeys/examples/password_manager](https://github.com/dfinity/vetkeys/tree/main/examples/password_manager)

## Prerequisites

Verify: `icp --version` must be >= 0.2.2. Older versions bundle an Internet Identity canister incompatible with `@icp-sdk/auth` v5 (symptom: `"Cannot read properties of undefined (reading 'anchor_number')"`).

### Rust

```toml
# Cargo.toml (workspace root)
[workspace]
members = ["backend"]
resolver = "2"

[workspace.dependencies]
ic-cdk = "0.19.0"
ic-stable-structures = "0.7.0"
ic-vetkeys = "0.6.0"
```

```toml
# backend/Cargo.toml
[package]
name = "encrypted-maps-backend"
version = "0.1.0"
edition = "2021"
rust-version = "1.85.0"

[lib]
path = "src/lib.rs"
crate-type = ["cdylib"]

[dependencies]
candid = "0.10"
ic-cdk = { workspace = true }
ic-dummy-getrandom-for-wasm = "0.1.0"
ic-stable-structures = { workspace = true }
ic-vetkeys = { workspace = true }
serde = "1"
```

### Motoko

```toml
# mops.toml
[dependencies]
base = "0.14.6"
ic-vetkeys = "0.4.0"
```

### Frontend

```json
{
  "dependencies": {
    "@dfinity/agent": "^3.4.0",
    "@dfinity/principal": "^3.4.0",
    "@dfinity/vetkeys": "^0.4.0",
    "@icp-sdk/auth": "^5.0.0",
    "@icp-sdk/core": "^5.0.0"
  }
}
```

`@dfinity/agent` and `@dfinity/principal` are required because `@dfinity/vetkeys` depends on them. `@icp-sdk/auth` provides Internet Identity login — import from `@icp-sdk/auth/client`, not the root module (the root has no exports). `@icp-sdk/core` provides canister ID discovery via the `ic_env` cookie set by `icp deploy`.

## Key Concepts

- **Map**: A named encrypted key-value store owned by a principal. Identified by `(owner_principal, map_name)`. Map names and map keys are `Blob<32>` — max 32 bytes each.
- **Access Rights**: `Read` (retrieve values), `ReadWrite` (retrieve + modify), `ReadWriteManage` (retrieve + modify + manage other users' access). Owners implicitly have full rights.
- **Encryption flow**: The `EncryptedMaps` frontend class handles everything: generates a transport key, requests an encrypted vetKey from the canister, decrypts it locally, derives AES-GCM key material, then encrypts/decrypts values. You call `setValue`/`getValue` with plaintext.
- **Shared encryption**: All authorized users of a map derive the same symmetric key (derivation input is `(owner, map_name)`), enabling multi-user access without re-encrypting per user.
- **Key caching**: The frontend library caches derived key material in IndexedDB. After the first key derivation for a map, subsequent operations are fast with no canister calls for key derivation.
- **Domain separator**: A string set during canister initialization (e.g. `"my_password_manager"`) that isolates keys per application and prevents cross-application key collisions.

## Common Pitfalls

1. **Using raw vetKeys API instead of EncryptedMaps.** Do not manually call `vetkd_derive_key`, generate transport keys, or wire AES-GCM. The `EncryptedMaps` frontend class handles all cryptographic operations internally. Call `setValue`/`getValue` with plaintext and let the library do the rest.

2. **Map names or keys exceeding 32 bytes.** Map names and map keys are `Blob<32>` on the backend. If you `TextEncoder.encode()` a string longer than 32 bytes, the canister rejects it with `"too large input"`. Use short identifiers or hash longer strings to 32 bytes.

3. **Inconsistent byte encoding.** The frontend uses `new TextEncoder().encode("name")` to produce `Uint8Array`. Always use the same encoding. If the backend stores under UTF-8 bytes, the frontend must use the same UTF-8 bytes to retrieve.

4. **Insufficient canister cycles.** Each `get_encrypted_vetkey` call triggers `vetkd_derive_key` on the management canister, which costs cycles. The library attaches cycles automatically, but the canister must have sufficient balance. Top up before testing.

5. **Deploying to mainnet with `test_key_1`.** It works on mainnet but is for testing. For production, deploy with init argument `"key_1"`. The key name is fixed at canister initialization.

6. **Treating `AccessRights` as strings in TypeScript.** In generated bindings, Candid variants are objects: `{ Read: null }`, `{ ReadWrite: null }`, `{ ReadWriteManage: null }`. Do not compare with `=== "Read"`.

7. **Using `ByteBuf` directly from the frontend.** The Candid interface uses `ByteBuf = record { inner : blob }` for Rust serialization compatibility. The `EncryptedMaps` frontend class accepts plain `Uint8Array` and wraps/unwraps `ByteBuf` internally. If you bypass the library and call the canister actor directly, you must wrap bytes as `{ inner: yourUint8Array }`.

8. **Empty maps are not visible.** `getAllAccessibleMaps()` and `get_owned_non_empty_map_names` only return maps that contain at least one entry. You cannot "create an empty vault" — the map won't appear until you insert a value. If your UI needs to show empty containers, insert a sentinel entry (e.g., key `__meta__`) when creating the map and filter it out on read.

## Implementation

### Rust Backend

The backend is a thin wrapper around the `ic-vetkeys` EncryptedMaps library. It delegates all logic to the library and exposes Candid methods.

```rust
// backend/src/lib.rs
use std::cell::RefCell;
use candid::Principal;
use ic_cdk::management_canister::{VetKDCurve, VetKDKeyId};
use ic_cdk::{init, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::storable::Blob;
use ic_stable_structures::DefaultMemoryImpl;
use ic_vetkeys::encrypted_maps::{EncryptedMapData, EncryptedMaps, VetKey, VetKeyVerificationKey};
use ic_vetkeys::types::{AccessRights, ByteBuf, EncryptedMapValue, TransportKey};

type Memory = VirtualMemory<DefaultMemoryImpl>;
type MapId = (Principal, ByteBuf);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));
    static ENCRYPTED_MAPS: RefCell<Option<EncryptedMaps<AccessRights>>> =
        const { RefCell::new(None) };
}

#[init]
fn init(key_name: String) {
    let key_id = VetKDKeyId {
        curve: VetKDCurve::Bls12_381_G2,
        name: key_name,
    };
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.replace(EncryptedMaps::init(
            "my_app_domain", // domain separator — change per application
            key_id,
            id_to_memory(0), // config
            id_to_memory(1), // access control
            id_to_memory(2), // shared keys
            id_to_memory(3), // map key-values
        ))
    });
}

// --- Query methods ---

#[query]
fn get_accessible_shared_map_names() -> Vec<(Principal, ByteBuf)> {
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_accessible_shared_map_names(ic_cdk::api::msg_caller())
            .into_iter()
            .map(|id| (id.0, ByteBuf::from(id.1.as_ref().to_vec())))
            .collect()
    })
}

#[query]
fn get_owned_non_empty_map_names() -> Vec<ByteBuf> {
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_owned_non_empty_map_names(ic_cdk::api::msg_caller())
            .into_iter()
            .map(|n| ByteBuf::from(n.as_slice().to_vec()))
            .collect()
    })
}

#[query]
fn get_all_accessible_encrypted_maps() -> Vec<EncryptedMapData<AccessRights>> {
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_all_accessible_encrypted_maps(ic_cdk::api::msg_caller())
    })
}

#[query]
fn get_all_accessible_encrypted_values() -> Vec<(MapId, Vec<(ByteBuf, EncryptedMapValue)>)> {
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_all_accessible_encrypted_values(ic_cdk::api::msg_caller())
    }).into_iter().map(|((owner, name), vals)| {
        ((owner, ByteBuf::from(name.as_ref().to_vec())),
         vals.into_iter()
             .map(|(k, v)| (ByteBuf::from(k.as_ref().to_vec()), v)).collect())
    }).collect()
}

#[query]
fn get_encrypted_values_for_map(
    map_owner: Principal, map_name: ByteBuf,
) -> Result<Vec<(ByteBuf, EncryptedMapValue)>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_encrypted_values_for_map(ic_cdk::api::msg_caller(), (map_owner, map_name))
    }).map(|vals| vals.into_iter()
        .map(|(k, v)| (ByteBuf::from(k.as_slice().to_vec()), v)).collect())
}

#[query]
fn get_encrypted_value(
    map_owner: Principal, map_name: ByteBuf, map_key: ByteBuf,
) -> Result<Option<EncryptedMapValue>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap().get_encrypted_value(
            ic_cdk::api::msg_caller(), (map_owner, map_name), bytebuf_to_blob(map_key)?,
        )
    })
}

#[query]
fn get_shared_user_access_for_map(
    key_owner: Principal, key_name: ByteBuf,
) -> Result<Vec<(Principal, AccessRights)>, String> {
    let key_name = bytebuf_to_blob(key_name)?;
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_shared_user_access_for_map(ic_cdk::api::msg_caller(), (key_owner, key_name))
    })
}

#[query]
fn get_user_rights(
    map_owner: Principal, map_name: ByteBuf, user: Principal,
) -> Result<Option<AccessRights>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap()
            .get_user_rights(ic_cdk::api::msg_caller(), (map_owner, map_name), user)
    })
}

// --- Update methods ---

#[update]
fn insert_encrypted_value(
    map_owner: Principal, map_name: ByteBuf, map_key: ByteBuf, value: EncryptedMapValue,
) -> Result<Option<EncryptedMapValue>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.as_mut().unwrap().insert_encrypted_value(
            ic_cdk::api::msg_caller(), (map_owner, map_name), bytebuf_to_blob(map_key)?, value,
        )
    })
}

#[update]
fn remove_encrypted_value(
    map_owner: Principal, map_name: ByteBuf, map_key: ByteBuf,
) -> Result<Option<EncryptedMapValue>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.as_mut().unwrap().remove_encrypted_value(
            ic_cdk::api::msg_caller(), (map_owner, map_name), bytebuf_to_blob(map_key)?,
        )
    })
}

#[update]
fn remove_map_values(
    map_owner: Principal, map_name: ByteBuf,
) -> Result<Vec<EncryptedMapValue>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.as_mut().unwrap()
            .remove_map_values(ic_cdk::api::msg_caller(), (map_owner, map_name))
    }).map(|removed| removed.into_iter()
        .map(|k| ByteBuf::from(k.as_ref().to_vec())).collect())
}

#[update]
fn set_user_rights(
    map_owner: Principal, map_name: ByteBuf, user: Principal, access_rights: AccessRights,
) -> Result<Option<AccessRights>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.as_mut().unwrap().set_user_rights(
            ic_cdk::api::msg_caller(), (map_owner, map_name), user, access_rights,
        )
    })
}

#[update]
fn remove_user(
    map_owner: Principal, map_name: ByteBuf, user: Principal,
) -> Result<Option<AccessRights>, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    ENCRYPTED_MAPS.with_borrow_mut(|em| {
        em.as_mut().unwrap()
            .remove_user(ic_cdk::api::msg_caller(), (map_owner, map_name), user)
    })
}

// --- VetKey methods (async — call management canister) ---

#[update]
async fn get_vetkey_verification_key() -> VetKeyVerificationKey {
    ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap().get_vetkey_verification_key()
    }).await
}

#[update]
async fn get_encrypted_vetkey(
    map_owner: Principal, map_name: ByteBuf, transport_key: TransportKey,
) -> Result<VetKey, String> {
    let map_name = bytebuf_to_blob(map_name)?;
    Ok(ENCRYPTED_MAPS.with_borrow(|em| {
        em.as_ref().unwrap().get_encrypted_vetkey(
            ic_cdk::api::msg_caller(), (map_owner, map_name), transport_key,
        )
    })?.await)
}

// --- Helpers ---

fn bytebuf_to_blob(buf: ByteBuf) -> Result<Blob<32>, String> {
    Blob::try_from(buf.as_ref()).map_err(|_| "too large input".to_string())
}

fn id_to_memory(id: u8) -> Memory {
    MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(id)))
}

ic_cdk::export_candid!();
```

### Motoko Backend

A complete Motoko backend is available in `references/motoko-backend.md`. It exposes the same Candid interface as the Rust backend and uses `ic-vetkeys` from mops.

### icp.yaml

```yaml
canisters:
  - name: backend
    recipe:
      type: "@dfinity/rust@v3.2.0"       # Motoko: "@dfinity/motoko@v4.1.0"
      configuration:
        package: encrypted-maps-backend   # Motoko: main: backend/src/Main.mo
    init_args: '("test_key_1")'           # Use '("key_1")' for production

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

See the `icp-cli` skill for the full configuration reference.

### Frontend (TypeScript)

The `@dfinity/vetkeys` package includes the canister declarations, crypto, and the `EncryptedMaps` class. No binding generation (`@icp-sdk/bindgen`) is needed for the encrypted maps canister — the library bundles its own actor. You do need `@icp-sdk/core` for canister ID discovery. For the Internet Identity login flow (identity provider URL, session handling), see the `internet-identity` skill.

**Initialize:**

```typescript
import { HttpAgent } from "@dfinity/agent";
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import {
    DefaultEncryptedMapsClient,
    EncryptedMaps,
} from "@dfinity/vetkeys/encrypted_maps";

async function createEncryptedMaps(
    identity: import("@dfinity/agent").Identity,
): Promise<EncryptedMaps> {
    // icp deploy injects canister IDs via the ic_env cookie
    const canisterEnv = safeGetCanisterEnv();
    const canisterId = canisterEnv?.["PUBLIC_CANISTER_ID:backend"];

    const agent = await HttpAgent.create({
        identity,
        host: window.location.origin,
        rootKey: canisterEnv?.IC_ROOT_KEY, // undefined in production, Uint8Array locally
    });

    return new EncryptedMaps(
        new DefaultEncryptedMapsClient(agent, canisterId),
    );
}
```

**Store and retrieve values:**

```typescript
const owner = identity.getPrincipal();
const mapName = new TextEncoder().encode("passwords");   // max 32 bytes
const mapKey = new TextEncoder().encode("gmail");         // max 32 bytes
const value = new TextEncoder().encode(
    JSON.stringify({ username: "me@gmail.com", password: "s3cret" }),
);

// Store — encrypts automatically on the client
await encryptedMaps.setValue(owner, mapName, mapKey, value);

// Retrieve — decrypts automatically on the client
const decrypted = await encryptedMaps.getValue(owner, mapName, mapKey);
const data = JSON.parse(new TextDecoder().decode(decrypted));

// Delete a single value
await encryptedMaps.removeEncryptedValue(owner, mapName, mapKey);

// Delete all values in a map
await encryptedMaps.removeMapValues(owner, mapName);
```

**List all maps and values:**

```typescript
const allMaps = await encryptedMaps.getAllAccessibleMaps();
for (const map of allMaps) {
    const name = new TextDecoder().decode(map.mapName);
    console.log(`Map: ${name}, Owner: ${map.mapOwner.toText()}`);
    for (const [keyBytes, valueBytes] of map.keyvals) {
        const key = new TextDecoder().decode(keyBytes);
        const value = new TextDecoder().decode(valueBytes);
        console.log(`  ${key}: ${value}`);
    }
}
```

**Share a map with another user:**

```typescript
import { Principal } from "@dfinity/principal"; // also re-exported by @icp-sdk/core

const otherUser = Principal.fromText("xxxxx-xxxxx-xxxxx-xxxxx-cai");

// Grant ReadWrite access
await encryptedMaps.setUserRights(
    owner,    // must be the map owner's principal
    mapName,
    otherUser,
    { ReadWrite: null },  // Candid variant — NOT a string
);

// Check access
const rights = await encryptedMaps.getUserRights(owner, mapName, otherUser);
// rights is { ReadWrite: null } or undefined

// List all users with access
const users = await encryptedMaps.getSharedUserAccessForMap(owner, mapName);
// users is Array<[Principal, AccessRights]>

// Revoke access
await encryptedMaps.removeUser(owner, mapName, otherUser);
```

## Deploy & Verify

```bash
icp network start -d
icp deploy backend

# 1. Backend responds — expected: (vec {})
icp canister call backend get_owned_non_empty_map_names '()'

# 2. VetKey works (costs cycles) — expected: (record { inner = blob "..." }) 96+ bytes
icp canister call backend get_vetkey_verification_key '()'

# 3. Frontend: authenticate, store a value, retrieve it (should match),
#    share with second user (they can read), revoke (they can't)

# Mainnet: change init_args to '("key_1")' in icp.yaml, then:
# icp deploy backend -e ic
# icp cycles top-up backend 10T -e ic
```
