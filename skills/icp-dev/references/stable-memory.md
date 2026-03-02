# Stable Memory & Canister Upgrades

Stable memory is persistent storage on Internet Computer that survives canister upgrades. Heap memory (regular variables) is wiped on every upgrade. Any data you care about MUST be in stable memory, or it will be lost the next time the canister is deployed.

## Canister IDs

No external canister dependencies. Stable memory is a local canister feature.

## Mistakes That Break Your Build

1. **Using `thread_local! { RefCell<T> }` for user data (Rust)** -- This is heap memory. It is wiped on every canister upgrade. All user data, balances, settings stored this way will vanish after `icp deploy`. Use `StableBTreeMap` instead.

2. **Forgetting `#[post_upgrade]` handler (Rust)** -- Without a `post_upgrade` function, the canister may silently reset state or behave unexpectedly after upgrade. Always define both `#[init]` and `#[post_upgrade]`.

3. **Using `stable` keyword in persistent actors (Motoko)** -- In mo:core `persistent actor`, all `let` and `var` declarations are automatically stable. Writing `stable let` produces warning M0218 and `stable var` is redundant. Just use `let` and `var`.

4. **Confusing heap memory limits with stable memory limits (Rust)** -- Heap (Wasm linear) memory is limited to 4GB. Stable memory can grow up to hundreds of GB (the subnet storage limit). The real danger: if you use `pre_upgrade`/`post_upgrade` hooks to serialize heap data to stable memory and deserialize it back, you are limited by the 4GB heap AND by the instruction limit for upgrade hooks. Large datasets will trap during upgrade, bricking the canister. The solution is to use stable structures (`StableBTreeMap`, `StableCell`, etc.) that read/write directly to stable memory, bypassing the heap entirely. Use `MemoryManager` to partition stable memory into virtual memories so multiple structures can coexist without overwriting each other.

5. **Changing record field types between upgrades (Motoko)** -- Altering the type of a persistent field (e.g., `Nat` to `Int`, or renaming a record field) will trap on upgrade and data is unrecoverable. Only ADD new optional fields. Never remove or rename existing ones.

6. **Serializing large data in pre_upgrade (Rust)** -- `pre_upgrade` has a fixed instruction limit. If you serialize a large HashMap to stable memory in pre_upgrade, it will hit the limit and trap, bricking the canister. Use `StableBTreeMap` which writes directly to stable memory and needs no serialization step.

7. **Using `actor { }` instead of `persistent actor { }` (Motoko)** -- Plain `actor` in mo:core requires explicit `stable` annotations and pre/post_upgrade hooks. `persistent actor` makes everything stable by default. Always use `persistent actor`.

## Key Patterns

### Motoko

```motoko
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Time "mo:core/Time";

persistent actor {

  type User = { id : Nat; name : Text; created : Int };

  // Survives upgrades automatically — no "stable" keyword needed
  let users = Map.empty<Nat, User>();
  var userCounter : Nat = 0;

  // Transient data — resets to initial value on every upgrade
  transient var requestCount : Nat = 0;

  public func addUser(name : Text) : async Nat {
    let id = userCounter;
    Map.add(users, Nat.compare, id, { id; name; created = Time.now() });
    userCounter += 1;
    id
  };

  public query func getUser(id : Nat) : async ?User {
    Map.get(users, Nat.compare, id)
  };
};
```

### Rust

```rust
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableCell,
};
use ic_cdk::{init, post_upgrade, query, update};
use candid::{CandidType, Deserialize};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Stable storage — survives upgrades
    static USERS: RefCell<StableBTreeMap<u64, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));

    static COUNTER: RefCell<StableCell<u64, Memory>> =
        RefCell::new(StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            0u64,
        ));
}

#[derive(CandidType, Deserialize, Clone)]
struct User { id: u64, name: String, created: u64 }

#[init]
fn init() {}

#[post_upgrade]
fn post_upgrade() {
    // Stable structures auto-restore — no deserialization needed
}

#[update]
fn add_user(name: String) -> u64 {
    let id = COUNTER.with(|c| {
        let mut cell = c.borrow_mut();
        let current = *cell.get();
        cell.set(current + 1);
        current
    });
    let user = User { id, name, created: ic_cdk::api::time() };
    let serialized = candid::encode_one(&user).expect("Failed to serialize");
    USERS.with(|users| { users.borrow_mut().insert(id, serialized); });
    id
}

#[query]
fn get_user(id: u64) -> Option<User> {
    USERS.with(|users| {
        users.borrow().get(&id).and_then(|bytes| candid::decode_one(&bytes).ok())
    })
}
```
