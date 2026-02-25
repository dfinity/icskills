---
id: stable-memory
name: "Stable Memory & Upgrades"
category: Architecture
description: "Manage canister state across upgrades. Stable structures, pre/post upgrade hooks, and memory-mapped data."
endpoints: 6
version: 2.0.0
status: stable
dependencies: []
---

# Stable Memory & Canister Upgrades
> version: 1.0.0 | requires: [dfx >= 0.30.0]

## What This Is
Stable memory is persistent storage on Internet Computer that survives canister upgrades. Heap memory (regular variables) is wiped on every upgrade. Any data you care about MUST be in stable memory, or it will be lost the next time the canister is deployed.

## Prerequisites
- dfx >= 0.30.0
- For Motoko: mops with `core = "2.0.0"` in mops.toml
- For Rust: `ic-stable-structures = "0.7"` in Cargo.toml

## Canister IDs
No external canister dependencies. Stable memory is a local canister feature.

## Mistakes That Break Your Build

1. **Using `thread_local! { RefCell<T> }` for user data (Rust)** -- This is heap memory. It is wiped on every canister upgrade. All user data, balances, settings stored this way will vanish after `dfx deploy`. Use `StableBTreeMap` instead.

2. **Forgetting `#[post_upgrade]` handler (Rust)** -- Without a `post_upgrade` function, the canister may silently reset state or behave unexpectedly after upgrade. Always define both `#[init]` and `#[post_upgrade]`.

3. **Using `stable` keyword in persistent actors (Motoko)** -- In mo:core `persistent actor`, all `let` and `var` declarations are automatically stable. Writing `stable let` produces warning M0218 and `stable var` is redundant. Just use `let` and `var`.

4. **Confusing heap memory limits with stable memory limits (Rust)** -- Heap (Wasm linear) memory is limited to 4GB. Stable memory can grow up to hundreds of GB (the subnet storage limit). The real danger: if you use `pre_upgrade`/`post_upgrade` hooks to serialize heap data to stable memory and deserialize it back, you are limited by the 4GB heap AND by the instruction limit for upgrade hooks. Large datasets will trap during upgrade, bricking the canister. The solution is to use stable structures (`StableBTreeMap`, `StableCell`, etc.) that read/write directly to stable memory, bypassing the heap entirely. Use `MemoryManager` to partition stable memory into virtual memories so multiple structures can coexist without overwriting each other.

5. **Changing record field types between upgrades (Motoko)** -- Altering the type of a persistent field (e.g., `Nat` to `Int`, or renaming a record field) will trap on upgrade and data is unrecoverable. Only ADD new optional fields. Never remove or rename existing ones.

6. **Serializing large data in pre_upgrade (Rust)** -- `pre_upgrade` has a fixed instruction limit. If you serialize a large HashMap to stable memory in pre_upgrade, it will hit the limit and trap, bricking the canister. Use `StableBTreeMap` which writes directly to stable memory and needs no serialization step.

7. **Using `actor { }` instead of `persistent actor { }` (Motoko)** -- Plain `actor` in mo:core requires explicit `stable` annotations and pre/post_upgrade hooks. `persistent actor` makes everything stable by default. Always use `persistent actor`.

## Implementation

### Motoko

With mo:core 2.0, `persistent actor` makes stable storage trivial. All `let` and `var` declarations inside the actor body are automatically persisted across upgrades.

```motoko
import Map "mo:core/Map";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Text "mo:core/Text";
import Time "mo:core/Time";

persistent actor {

  // Types -- must be inside actor body
  type User = {
    id : Nat;
    name : Text;
    created : Int;
  };

  // These survive upgrades automatically -- no "stable" keyword needed
  let users = Map.empty<Nat, User>();
  var userCounter : Nat = 0;
  let tags = List.empty<Text>();

  // Transient data -- reset to initial value on every upgrade
  transient var requestCount : Nat = 0;

  public func addUser(name : Text) : async Nat {
    let id = userCounter;
    Map.add(users, Nat.compare, id, {
      id;
      name;
      created = Time.now();
    });
    userCounter += 1;
    requestCount += 1;
    id
  };

  public query func getUser(id : Nat) : async ?User {
    Map.get(users, Nat.compare, id)
  };

  public query func getUserCount() : async Nat {
    Map.size(users)
  };

  // requestCount resets to 0 after every upgrade
  public query func getRequestCount() : async Nat {
    requestCount
  };
}
```

Key rules for Motoko persistent actors:
- `let` for Map, List, Set, Queue -- auto-persisted, no serialization
- `var` for simple values (Nat, Text, Bool) -- auto-persisted
- `transient var` for caches, counters that should reset on upgrade
- NO `pre_upgrade` / `post_upgrade` needed -- the runtime handles it
- NO `stable` keyword -- it is redundant and produces warnings

#### mops.toml

```toml
[package]
name = "my-project"
version = "0.1.0"

[dependencies]
core = "2.0.0"
```

### Rust

Rust canisters use `ic-stable-structures` for persistent storage. The `MemoryManager` partitions stable memory (up to hundreds of GB, limited by subnet storage) into virtual memories, each backing a different data structure.

#### Cargo.toml

```toml
[dependencies]
ic-cdk = "0.18"
ic-stable-structures = "0.7"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
```

#### Single Stable Structure (Simple Case)

```rust
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap,
};
use ic_cdk::{init, post_upgrade, query, update};
use candid::{CandidType, Deserialize};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Stable storage -- survives upgrades
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<StableBTreeMap<u64, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        ));

    // Counter stored in stable memory via StableCell
    static COUNTER: RefCell<ic_stable_structures::StableCell<u64, Memory>> =
        RefCell::new(ic_stable_structures::StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            0u64,
        ).expect("Failed to init counter"));
}

#[derive(CandidType, Deserialize, Clone)]
struct User {
    id: u64,
    name: String,
    created: u64,
}

#[init]
fn init() {
    // Any one-time initialization
}

#[post_upgrade]
fn post_upgrade() {
    // Stable structures auto-restore -- no deserialization needed
    // Re-init timers or other transient state here
}

#[update]
fn add_user(name: String) -> u64 {
    let id = COUNTER.with(|c| {
        let mut cell = c.borrow_mut();
        let current = *cell.get();
        cell.set(current + 1).expect("Failed to increment counter");
        current
    });

    let user = User {
        id,
        name,
        created: ic_cdk::api::time(),
    };

    let serialized = candid::encode_one(&user).expect("Failed to serialize user");

    USERS.with(|users| {
        users.borrow_mut().insert(id, serialized);
    });

    id
}

#[query]
fn get_user(id: u64) -> Option<User> {
    USERS.with(|users| {
        users.borrow().get(&id).and_then(|bytes| {
            candid::decode_one(&bytes).ok()
        })
    })
}

#[query]
fn get_user_count() -> u64 {
    USERS.with(|users| users.borrow().len())
}
```

#### Multiple Stable Structures with MemoryManager

```rust
use ic_stable_structures::{
    memory_manager::{MemoryId, MemoryManager, VirtualMemory},
    DefaultMemoryImpl, StableBTreeMap, StableCell, StableLog,
};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

// Each structure gets its own MemoryId -- NEVER reuse IDs
const USERS_MEM_ID: MemoryId = MemoryId::new(0);
const POSTS_MEM_ID: MemoryId = MemoryId::new(1);
const COUNTER_MEM_ID: MemoryId = MemoryId::new(2);
const LOG_INDEX_MEM_ID: MemoryId = MemoryId::new(3);
const LOG_DATA_MEM_ID: MemoryId = MemoryId::new(4);

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<StableBTreeMap<u64, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(USERS_MEM_ID))
        ));

    static POSTS: RefCell<StableBTreeMap<u64, Vec<u8>, Memory>> =
        RefCell::new(StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(POSTS_MEM_ID))
        ));

    static COUNTER: RefCell<StableCell<u64, Memory>> =
        RefCell::new(StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(COUNTER_MEM_ID)),
            0u64,
        ).expect("Failed to init counter"));

    static AUDIT_LOG: RefCell<StableLog<Vec<u8>, Memory, Memory>> =
        RefCell::new(StableLog::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(LOG_INDEX_MEM_ID)),
            MEMORY_MANAGER.with(|m| m.borrow().get(LOG_DATA_MEM_ID)),
        ).expect("Failed to init log"));
}
```

Key rules for Rust stable structures:
- `MemoryManager` partitions stable memory -- each structure gets a unique `MemoryId`
- NEVER reuse a `MemoryId` for two different structures -- they will corrupt each other
- `StableBTreeMap` keys must implement `Storable` + `Ord`, values must implement `Storable`
- For complex types, serialize to `Vec<u8>` with candid or serde
- `StableCell` for single values (counters, config)
- `StableLog` for append-only logs (needs two memory regions: index + data)
- `thread_local! { RefCell<StableBTreeMap<...>> }` is the correct pattern -- the RefCell wraps the stable structure, not a heap HashMap
- No `pre_upgrade`/`post_upgrade` serialization needed -- data is already in stable memory

## Deploy & Test

### Motoko: Verify Persistence Across Upgrades

```bash
# Start local replica
dfx start --background

# Deploy
dfx deploy backend

# Add data
dfx canister call backend addUser '("Alice")'
# Expected: (0 : nat)

dfx canister call backend addUser '("Bob")'
# Expected: (1 : nat)

# Verify data exists
dfx canister call backend getUserCount '()'
# Expected: (2 : nat)

dfx canister call backend getUser '(0)'
# Expected: (opt record { id = 0 : nat; name = "Alice"; created = ... })

# Now upgrade the canister (simulates code change + redeploy)
dfx deploy backend

# Verify data survived the upgrade
dfx canister call backend getUserCount '()'
# Expected: (2 : nat) -- STILL 2, not 0

dfx canister call backend getUser '(1)'
# Expected: (opt record { id = 1 : nat; name = "Bob"; created = ... })
```

### Rust: Verify Persistence Across Upgrades

```bash
dfx start --background

dfx deploy backend

dfx canister call backend add_user '("Alice")'
# Expected: (0 : nat64)

dfx canister call backend get_user_count '()'
# Expected: (1 : nat64)

# Upgrade
dfx deploy backend

# Verify persistence
dfx canister call backend get_user_count '()'
# Expected: (1 : nat64) -- data survived

dfx canister call backend get_user '(0)'
# Expected: (opt record { id = 0 : nat64; name = "Alice"; created = ... })
```

## Verify It Works

The definitive test for stable memory: data survives upgrade.

```bash
# 1. Deploy and add data
dfx deploy backend
dfx canister call backend addUser '("TestUser")'

# 2. Record the count
dfx canister call backend getUserCount '()'
# Note the number

# 3. Upgrade (redeploy)
dfx deploy backend

# 4. Check count again -- must be identical
dfx canister call backend getUserCount '()'
# Must match step 2

# 5. Verify transient data DID reset
dfx canister call backend getRequestCount '()'
# Expected: (0 : nat) -- transient var resets on upgrade
```

If the count drops to 0 after step 3, your data is NOT in stable memory. Review your storage declarations.
