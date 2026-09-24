---
name: certified-variables
description: "Serve cryptographically verified responses from query calls using Merkle trees and subnet BLS signatures. Covers the certified data API, RbTree/CertTree construction, witness generation, HTTP response certification for custom http_request canisters (ic-http-certification), and frontend certificate validation (@dfinity/certificate-verification). Use when query responses need verification, certified data, or response authenticity proofs. For static frontends served by the certified-assets canister, use the static-site skill instead: certification is automatic there."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2"
metadata:
  title: Certified Variables
  category: Security
---

# Certified Variables

## What This Is

Query responses on the Internet Computer come from a single replica and are NOT verified by consensus. A malicious or faulty replica could return fabricated data. Certification solves this: the canister stores a hash in the subnet's certified state tree during update calls, and then query responses include a certificate signed by the subnet's threshold BLS key proving the data is authentic. The result is responses that are both fast (no consensus delay) AND cryptographically verified.

Static assets served by the certified-assets canister (`@dfinity/static-site` recipe) are certified automatically and verified by the HTTP gateway — load the `static-site` skill for those. This skill covers certifying your own canister data and your own `http_request` responses.

## Prerequisites

| Side | Package | Version | Used for |
|------|---------|---------|----------|
| Rust | `ic-cdk` | 0.20 | `certified_data_set` / `data_certificate` |
| Rust | `ic-certification` (feature `serde`) | 4 | `RbTree` Merkle map with witnesses |
| Rust | `ic-http-certification` | 4 | certifying `http_request` responses |
| Motoko | `core` | 2.6 | `mo:core/CertifiedData` |
| Motoko | `ic-certification` (mops) | 1.1 | `CertTree` Merkle tree with witnesses |
| Motoko | `sha2` (mops) | 0.2 | hashing a single certified value |
| Frontend | `@icp-sdk/core` | ^6 | agent, `Certificate`, `lookup_path` |
| Frontend | `@dfinity/certificate-verification` | ^4 | witness verification (peers `@icp-sdk/core` ^6, takes `Uint8Array`) |

`ic-certified-map` 0.4 exposes the same `RbTree`/`AsHashTree` API and still works, but `ic-certification` is maintained alongside `ic-http-certification` and is what the official examples use.

## System API and Root Key

No external canister IDs required. Certification uses the IC system API exposed through CDK wrappers:
- `ic_cdk::api::certified_data_set` (Rust) / `CertifiedData.set` (Motoko) -- called during update calls to set the certified hash (max 32 bytes)
- `ic_cdk::api::data_certificate` (Rust) / `CertifiedData.getCertificate` (Motoko) -- called during query calls to retrieve the subnet certificate

Client-side verification needs the root key of the network the canister runs on:
- **Browser:** `safeGetCanisterEnv()?.IC_ROOT_KEY` from the `ic_env` cookie (`@icp-sdk/core/agent/canister-env`), set by the frontend canister on local networks and mainnet alike. It is the key of the network serving the page; to verify a canister on another network (e.g. mainnet data from a local dev server), use that network's key.
- **Node scripts and tests:** `root_key` from `icp network status --json`, hex-decoded to bytes.
- **Mainnet** (also `@icp-sdk/core`'s built-in default): `308182301d060d2b0601040182dc7c0503010201060c2b0601040182dc7c05030201036100814c0e6ec71fab583b08bd81373c255c3c371b2e84863c98a4f1e08b74235d14fb5d9c0cd546d9685f913a0c0b2cc5341583bf4b4392e467db96d65b9bb4cb717112f8472e0d5a4d14505ffd7484b01291091c5f87b98883463f98091a0baaae`

Never call `fetchRootKey()` in shipped code: it trusts whatever key the replica sends (see the `canister-security` skill).

## Mistakes That Break Your Build

1. **Trying to store more than 32 bytes of certified data.** The `certified_data_set` API accepts exactly one blob of at most 32 bytes. You cannot certify arbitrary data directly. Instead, build a Merkle tree over your data and certify only the root hash (32 bytes). The tree structure provides proofs for individual values.

2. **Calling `certified_data_set` in a query call.** Certification can ONLY be set during update calls (which go through consensus). Calling it in a query traps. Pattern: set the hash during writes, read the certificate during queries.

3. **Forgetting to include the certificate in query responses.** The certificate is obtained via `data_certificate()` during query calls. If you return data without the certificate, clients cannot verify anything. Return the data, the certificate and (for a Merkle tree) the witness.

4. **Not updating the certified hash after data changes.** If you modify the data but forget to call `certified_data_set` with the new root hash, query responses will fail verification because the certificate proves a stale hash.

5. **Building the witness for the wrong key.** The witness (Merkle proof) must correspond to the exact key being queried. A witness for key "users/alice" will not verify key "users/bob".

6. **Expecting a certificate from a call that is not a query call.** `data_certificate()` returns `None`/`null` in update calls, and a query method invoked as an update call counts as one. **`icp canister call` sends an update call unless you pass `--query`**: without it, the Rust example below traps on its `expect`, and the Motoko examples return `certificate = null`. Always test certified getters with `icp canister call --query`. Frontend code calling a `query` method through an actor sends a query call automatically.

7. **Losing the tree on upgrade, not the certified data.** The certified data itself survives upgrades (install and reinstall start it empty). What does not survive is a Merkle tree kept on the heap: the Rust `RbTree` below is wiped on upgrade while the old hash stays set, so `#[post_upgrade]` must rebuild the tree (from stable storage in a real app, see the `stable-memory` skill) and call `certified_data_set` again. A Motoko `CertTree.Store` persists with the actor, so nothing needs re-setting after an upgrade.

8. **Not validating certificate freshness on the client.** The certificate's state tree contains a `/time` field with the timestamp when the subnet produced it. Clients MUST check that this timestamp is recent (recommended: within 5 minutes of current time). Without this check, an attacker could replay a stale certificate with outdated data. `verifyCertification` enforces this through `maxCertificateTimeOffsetMs`; `Certificate.create` enforces ±5 minutes by default (`maxAgeInMinutes`).

9. **Treating every non-`Found` lookup as "absent".** `lookup_path` returns a status: `Found` (value proven), `Absent` (absence proven), or `Unknown`/`Error` (the witness does not cover the path). Only `Absent` proves a key does not exist. Collapsing `Unknown` into "not found" (for example with `lookupResultToBuffer`, which returns `undefined` for all three) lets a replica send a witness for a different key and make a real value look missing.

10. **Declaring the Motoko `CertTree.Ops` object as stable.** In a persistent actor, `let ct = CertTree.Ops(certStore)` fails with `M0131` (`variable ct is declared stable but has non-stable type`). Declare it `transient let ct = CertTree.Ops(certStore);`; only the `CertTree.Store` is stable.

11. **Certifying an HTTP response without its `IC-CertificateExpression` header.** With `ic-http-certification`, the header carrying the CEL expression must be part of the response you certify; `HttpCertification::response_only`/`full` return `CertificateExpressionHeaderMissing` otherwise. Serve exactly that response, plus the `IC-Certificate` header from `add_v2_certificate_header`, or the HTTP gateway rejects it with `backend_response_verification`.

## How Certification Works

```
UPDATE CALL (goes through consensus):
  1. Canister modifies data
  2. Canister builds/updates Merkle tree
  3. Canister calls certified_data_set(root_hash)  -- 32 bytes
  4. Subnet includes root_hash in its certified state tree

QUERY CALL (single replica, no consensus):
  1. Client sends query
  2. Canister calls data_certificate() -- gets subnet BLS signature
  3. Canister builds witness (Merkle proof) for the requested key
  4. Canister returns: { data, certificate, witness }

CLIENT VERIFICATION:
  1. Verify certificate signature against IC root public key
  2. Check the certificate /time is fresh
  3. Reconstruct the witness root hash and compare it with the certificate's certified_data
  4. Look up the key in the witness and trust the data only if it is Found (or Absent)
```

## Implementation

### Rust

**Cargo.toml:**

```toml
[package]
name = "certified_vars_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
candid = "0.10"
ic-cdk = "0.20"
ic-certification = { version = "4", features = ["serde"] }
serde = { version = "1", features = ["derive"] }
serde_bytes = "0.11"
ciborium = "0.2"
```

**Complete certified key-value store:**

```rust
use candid::{CandidType, Deserialize};
use ic_cdk::{init, post_upgrade, query, update};
use ic_certification::{AsHashTree, RbTree};
use serde_bytes::ByteBuf;
use std::cell::RefCell;

thread_local! {
    // RbTree is a Merkle-tree-backed map: keys and values are byte slices
    static TREE: RefCell<RbTree<Vec<u8>, Vec<u8>>> = RefCell::new(RbTree::new());
}

// Update the certified data hash after any modification
fn update_certified_data() {
    TREE.with(|tree| {
        let tree = tree.borrow();
        // root_hash() returns a 32-byte SHA-256 hash of the entire tree
        ic_cdk::api::certified_data_set(&tree.root_hash());
    });
}

#[init]
fn init() {
    update_certified_data();
}

#[post_upgrade]
fn post_upgrade() {
    // The heap TREE is empty after an upgrade, while the old certified hash is kept.
    // Rebuild TREE from stable storage here, then re-set the hash to match it.
    update_certified_data();
}

#[update]
fn set(key: String, value: String) {
    TREE.with(|tree| {
        let mut tree = tree.borrow_mut();
        tree.insert(key.as_bytes().to_vec(), value.as_bytes().to_vec());
    });
    // Must update certified hash after every data change
    update_certified_data();
}

#[update]
fn delete(key: String) {
    TREE.with(|tree| {
        let mut tree = tree.borrow_mut();
        tree.delete(key.as_bytes());
    });
    update_certified_data();
}

#[derive(CandidType, Deserialize)]
struct CertifiedResponse {
    value: Option<String>,
    certificate: ByteBuf,      // subnet BLS signature
    witness: ByteBuf,          // Merkle proof for this key
}

#[query]
fn get(key: String) -> CertifiedResponse {
    // data_certificate() is only available in query calls (icp canister call --query)
    let certificate = ic_cdk::api::data_certificate()
        .expect("data_certificate only available in query calls");

    TREE.with(|tree| {
        let tree = tree.borrow();

        // Look up the value
        let value = tree.get(key.as_bytes())
            .map(|v| String::from_utf8(v.clone()).unwrap());

        // Build a witness (Merkle proof) for this specific key
        let witness = tree.witness(key.as_bytes());

        // Serialize the witness as CBOR
        let mut witness_buf = vec![];
        ciborium::into_writer(&witness, &mut witness_buf)
            .expect("Failed to serialize witness as CBOR");

        CertifiedResponse {
            value,
            certificate: ByteBuf::from(certificate),
            witness: ByteBuf::from(witness_buf),
        }
    })
}

// Batch set multiple values in one update call (more efficient)
#[update]
fn set_many(entries: Vec<(String, String)>) {
    TREE.with(|tree| {
        let mut tree = tree.borrow_mut();
        for (key, value) in entries {
            tree.insert(key.as_bytes().to_vec(), value.as_bytes().to_vec());
        }
    });
    // Single certification update for all changes
    update_certified_data();
}

// Required by the icp-cli Rust recipe, which extracts the Candid interface from the wasm
ic_cdk::export_candid!();
```

### HTTP Certification for Custom HTTP Canisters

Canisters that serve HTTP from their own `http_request` must certify each response with `ic-http-certification` so the HTTP gateway can verify it. Read `references/http-certification.md` before writing one: it has a complete, minimal canister (certify in `init`/`post_upgrade`, attach the witness in `http_request`) and the rules for the `IC-CertificateExpression` and `IC-Certificate` headers (pitfall 11).

### Motoko

**Using CertifiedData module:**

```motoko
import CertifiedData "mo:core/CertifiedData";
import Text "mo:core/Text";
// Requires: mops add sha2
import Sha256 "mo:sha2/Sha256";

persistent actor {

  // Simple certified single-value example:
  var certifiedValue : Text = "";

  // Set a certified value (update call only)
  public func setCertifiedValue(value : Text) : async () {
    certifiedValue := value;
    // Hash the value and set as certified data (max 32 bytes)
    let hash = Sha256.fromBlob(#sha256, Text.encodeUtf8(value));
    CertifiedData.set(hash);
  };

  // Get the certified value with its certificate (query call)
  public query func getCertifiedValue() : async {
    value : Text;
    certificate : ?Blob;
  } {
    {
      value = certifiedValue;
      certificate = CertifiedData.getCertificate();
    }
  };
};
```

A single value needs no witness: the client checks that `sha256(value)` equals the certificate's `certified_data` (see "Single value without a witness" below).

**Certified key-value store with Merkle tree (advanced):**

For certifying multiple values with per-key witnesses, use the `ic-certification` mops package (`mops add ic-certification`). It provides a real Merkle tree (`CertTree`) that can generate proofs for individual keys:

```motoko
import CertifiedData "mo:core/CertifiedData";
import Blob "mo:core/Blob";
import Text "mo:core/Text";
// Requires: mops add ic-certification
import CertTree "mo:ic-certification/CertTree";

persistent actor {

  // CertTree.Store is stable -- the tree persists across upgrades, and so does the certified data
  let certStore : CertTree.Store = CertTree.newStore();
  // Ops is an object with functions, not stable data: it must be transient
  transient let ct = CertTree.Ops(certStore);

  // Set certified data on init
  ct.setCertifiedData();

  // Set a key-value pair and update certification
  public func set(key : Text, value : Text) : async () {
    ct.put([Text.encodeUtf8(key)], Text.encodeUtf8(value));
    // CRITICAL: call after every mutation to update the subnet-certified root hash
    ct.setCertifiedData();
  };

  // Delete a key and update certification
  public func delete(key : Text) : async () {
    ct.delete([Text.encodeUtf8(key)]);
    ct.setCertifiedData();
  };

  // Query with certificate and Merkle witness for the requested key
  public query func get(key : Text) : async {
    value : ?Blob;
    certificate : ?Blob;
    witness : Blob;
  } {
    let path = [Text.encodeUtf8(key)];
    // reveal() generates a Merkle proof for this specific path
    let witness = ct.reveal(path);
    {
      value = ct.lookup(path);
      certificate = CertifiedData.getCertificate();
      witness = ct.encodeWitness(witness);
    }
  };
};
```

### Frontend Verification (TypeScript)

`@icp-sdk/core` ships every primitive needed (`Certificate.create`, `Cbor`, `reconstruct`, `lookup_path`). `@dfinity/certificate-verification` wraps them for the witness case and should be preferred there:
1. Verify certificate BLS signature against IC root key
2. Validate certificate freshness (`/time` within `maxCertificateTimeOffsetMs`)
3. CBOR-decode the witness into a HashTree
4. Reconstruct the witness root hash
5. Compare reconstructed root hash with `certified_data` from the certificate
6. Return the verified HashTree for value lookup

Pass the root key as described in "System API and Root Key". Candid `blob` fields arrive as `Uint8Array` in `@icp-sdk/bindgen` bindings, matching the parameters below.

**With a witness (Merkle tree):**

```typescript
import { verifyCertification } from "@dfinity/certificate-verification";
import { lookup_path, LookupPathStatus } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

const MAX_CERT_TIME_OFFSET_MS = 5 * 60 * 1000; // 5 minutes

export async function getVerifiedValue(
  rootKey: Uint8Array,
  canisterId: string,
  key: string,
  response: { value: string | null; certificate: Uint8Array; witness: Uint8Array },
): Promise<string | null> {
  // Steps 1-5; throws CertificateTimeError or CertificateVerificationError on failure.
  const tree = await verifyCertification({
    canisterId: Principal.fromText(canisterId),
    encodedCertificate: response.certificate,
    encodedTree: response.witness,
    rootKey,
    maxCertificateTimeOffsetMs: MAX_CERT_TIME_OFFSET_MS,
  });

  // Step 6: the path must match how the canister inserted the key (here: UTF-8 bytes).
  const result = lookup_path([new TextEncoder().encode(key)], tree);
  switch (result.status) {
    case LookupPathStatus.Found: {
      const verified = new TextDecoder().decode(result.value);
      if (response.value !== verified) throw new Error("value does not match witness");
      return verified;
    }
    case LookupPathStatus.Absent:
      if (response.value !== null) throw new Error("witness proves the key is absent");
      return null;
    default:
      // Unknown/Error: the witness does not cover this key, so it proves nothing
      throw new Error(`witness does not cover key (${result.status})`);
  }
}
```

**Single value without a witness** (the Motoko `CertifiedData` example above): `verifyCertification` needs a witness tree, so use `Certificate.create` directly. It verifies the signature and the ±5 minute freshness window:

```typescript
import { Certificate, lookupResultToBuffer, uint8Equals } from "@icp-sdk/core/agent";
import { Principal } from "@icp-sdk/core/principal";

export async function verifySingleValue(
  rootKey: Uint8Array,
  canisterId: string,
  response: { value: string; certificate: Uint8Array },
): Promise<string> {
  const principal = Principal.fromText(canisterId);
  const cert = await Certificate.create({
    certificate: response.certificate,
    rootKey,
    principal: { canisterId: principal },
  });
  const certifiedData = lookupResultToBuffer(
    cert.lookup_path(["canister", principal.toUint8Array(), "certified_data"]),
  );
  // Recompute what the canister certified: sha256 of the UTF-8 value
  const hash = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(response.value)),
  );
  if (!certifiedData || !uint8Equals(certifiedData, hash)) {
    throw new Error("value does not match certified data");
  }
  return response.value;
}
```

For a runnable end-to-end version (Motoko backend plus a browser frontend that performs these checks), see [dfinity/examples `motoko/cert-var`](https://github.com/dfinity/examples/tree/master/motoko/cert-var).

For canisters serving HTTP (certified assets or `http_request`), the HTTP gateway verifies certification using the [HTTP Gateway Protocol](https://docs.internetcomputer.org/references/http-gateway-protocol-spec) -- no client-side code needed.

## Deploy & Test

```bash
# Deploy the canister
icp deploy backend

# Set a certified value (update call -- goes through consensus)
icp canister call backend set '("greeting", "hello world")'

# Query the certified value -- --query is required, or no certificate is returned
icp canister call --query backend get '("greeting")'
# Returns: record { certificate = blob "..."; value = opt "hello world"; witness = blob "..." }

# Set multiple values
icp canister call backend set '("name", "Alice")'
icp canister call backend set '("age", "30")'

# Delete a value
icp canister call backend delete '("age")'
```

## Verify It Works

```bash
# 1. Verify certificate is present in query response
icp canister call --query backend get '("greeting")'
# Expected: certificate field is a non-empty blob
# Without --query, the call runs as an update: the Rust example traps, the Motoko examples return certificate = null

# 2. Verify data integrity after update
icp canister call backend set '("key1", "value1")'
icp canister call --query backend get '("key1")'
# Expected: value = opt "value1" with a certificate

# 3. Verify certification survives canister upgrade
icp canister call backend set '("persistent", "data")'
icp deploy backend  # triggers upgrade
icp canister call --query backend get '("persistent")'
# Motoko CertTree example: value survives and the certificate still verifies
# Rust example: the heap TREE is gone, so value = null, but the certificate still verifies
# (a proof of absence) because post_upgrade re-set the hash. Persist the data to keep it.

# 4. Verify non-existent key returns null value with valid certificate
icp canister call --query backend get '("nonexistent")'
# Expected: value = null, certificate = blob "..." (the witness proves absence)

# 5. Client-side verification
# Run getVerifiedValue / verifySingleValue against the response: it must return the value,
# and must throw if you change response.value before verifying.

# 6. For HTTP certification (custom HTTP canister):
curl -s -D - http://CANISTER_ID.localhost:8000/hello   # local; mainnet: https://CANISTER_ID.icp.net/hello
# Expected: 200, with IC-Certificate and IC-CertificateExpression headers
# A response that fails verification returns JSON with "error_type": "backend_response_verification"
```
