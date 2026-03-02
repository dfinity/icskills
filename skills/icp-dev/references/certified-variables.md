# Certified Variables & Certified Assets

Query responses on the Internet Computer come from a single replica and are NOT verified by consensus. Certification solves this: the canister stores a hash in the subnet's certified state tree during update calls, and then query responses include a certificate signed by the subnet's threshold BLS key proving the data is authentic. The result is responses that are both fast (no consensus delay) AND cryptographically verified.

## Canister IDs

No external canister IDs required. Certification uses the IC system API:
- `ic_cdk::api::certified_data_set` (Rust) / `CertifiedData.set` (Motoko) -- called during update calls to set the certified hash (max 32 bytes)
- `ic_cdk::api::data_certificate` (Rust) / `CertifiedData.getCertificate` (Motoko) -- called during query calls to retrieve the subnet certificate

## Mistakes That Break Your Build

1. **Trying to store more than 32 bytes of certified data.** The `certified_data_set` API accepts exactly one blob of at most 32 bytes. You cannot certify arbitrary data directly. Instead, build a Merkle tree over your data and certify only the root hash (32 bytes). The tree structure provides proofs for individual values.

2. **Calling `certified_data_set` in a query call.** Certification can ONLY be set during update calls (which go through consensus). Calling it in a query traps. Pattern: set the hash during writes, read the certificate during queries.

3. **Forgetting to include the certificate in query responses.** The certificate is obtained via `data_certificate()` during query calls. If you return data without the certificate, clients cannot verify anything. Always return a tuple of (data, certificate, witness).

4. **Not updating the certified hash after data changes.** If you modify the data but forget to call `certified_data_set` with the new root hash, query responses will fail verification because the certificate proves a stale hash.

5. **Building the witness for the wrong key.** The witness (Merkle proof) must correspond to the exact key being queried. A witness for key "users/alice" will not verify key "users/bob".

6. **Assuming `data_certificate()` returns a value in update calls.** It returns `null`/`None` during update calls. Certificates are only available during query calls.

7. **Certifying data at canister init but not on upgrades.** After a canister upgrade, the certified data is cleared. You must call `certified_data_set` in both `#[init]` and `#[post_upgrade]` (Rust) or `system func postupgrade` (Motoko) to re-establish certification.

8. **Not validating certificate freshness on the client.** The certificate's state tree contains a `/time` field. Clients MUST check that this timestamp is recent (recommended: within 5 minutes). Without this check, an attacker could replay a stale certificate with outdated data.

## Key Patterns

### Rust

```rust
use candid::{CandidType, Deserialize};
use ic_cdk::{init, post_upgrade, query, update};
use ic_certified_map::{AsHashTree, RbTree};
use serde_bytes::ByteBuf;
use std::cell::RefCell;

thread_local! {
    static TREE: RefCell<RbTree<Vec<u8>, Vec<u8>>> = RefCell::new(RbTree::new());
}

fn update_certified_data() {
    TREE.with(|tree| {
        let tree = tree.borrow();
        ic_cdk::api::certified_data_set(&tree.root_hash());
    });
}

#[init]
fn init() { update_certified_data(); }

#[post_upgrade]
fn post_upgrade() { update_certified_data(); } // CRITICAL: re-certify after upgrade

#[update]
fn set(key: String, value: String) {
    TREE.with(|tree| {
        tree.borrow_mut().insert(key.as_bytes().to_vec(), value.as_bytes().to_vec());
    });
    update_certified_data(); // Must update hash after every data change
}

#[derive(CandidType, Deserialize)]
struct CertifiedResponse {
    value: Option<String>,
    certificate: ByteBuf,
    witness: ByteBuf,
}

#[query]
fn get(key: String) -> CertifiedResponse {
    let certificate = ic_cdk::api::data_certificate()
        .expect("data_certificate only available in query calls");
    TREE.with(|tree| {
        let tree = tree.borrow();
        let value = tree.get(key.as_bytes()).map(|v| String::from_utf8(v.clone()).unwrap());
        let witness = tree.witness(key.as_bytes());
        let mut witness_buf = vec![];
        ciborium::into_writer(&witness, &mut witness_buf).expect("CBOR serialize failed");
        CertifiedResponse {
            value,
            certificate: ByteBuf::from(certificate),
            witness: ByteBuf::from(witness_buf),
        }
    })
}
```

### Motoko

```motoko
import CertifiedData "mo:core/CertifiedData";
import Text "mo:core/Text";
// Requires: mops add ic-certification
import CertTree "mo:ic-certification/CertTree";

persistent actor {
  let certStore : CertTree.Store = CertTree.newStore();
  let ct = CertTree.Ops(certStore);

  ct.setCertifiedData(); // Set certified data on init

  public func set(key : Text, value : Text) : async () {
    ct.put([Text.encodeUtf8(key)], Text.encodeUtf8(value));
    ct.setCertifiedData(); // CRITICAL: update after every mutation
  };

  public query func get(key : Text) : async {
    value : ?Blob;
    certificate : ?Blob;
    witness : Blob;
  } {
    let path = [Text.encodeUtf8(key)];
    let witness = ct.reveal(path);
    {
      value = ct.lookup(path);
      certificate = CertifiedData.getCertificate();
      witness = ct.encodeWitness(witness);
    }
  };

  system func postupgrade() {
    ct.setCertifiedData(); // Re-establish certification after upgrade
  };
};
```
