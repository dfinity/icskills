---
id: multi-canister
name: Multi-Canister Architecture
category: Architecture
description: "Design and deploy multi-canister dapps with inter-canister calls, shared state patterns, and upgrade strategies."
endpoints: 8
version: 3.0.2
status: stable
dependencies: [stable-memory]
requires: [icp-cli >= 0.1.0, mops, ic-cdk >= 0.19]
tags: [inter-canister, call, architecture, scaling, shared-state, upgrade, multi]
---

# Multi-Canister Architecture

## What This Is

Splitting an IC application across multiple canisters for scaling, separation of concerns, or independent upgrade cycles. Each canister has its own state, cycle balance, and upgrade path. Canisters communicate via async inter-canister calls.

## Prerequisites

- `icp-cli` >= 0.1.0 (`brew install dfinity/tap/icp-cli`)
- For Motoko: `mops` package manager, `core = "2.0.0"` in mops.toml
- For Rust: `ic-cdk >= 0.19`, `candid`, `serde`, `ic-stable-structures`
- Understanding of async/await and error handling

## When to Use Multi-Canister

| Reason | Threshold |
|---|---|
| Storage limits | Each canister: up to hundreds of GB stable memory + 4GB heap. If your data could exceed heap limits or benefit from partitioning, split storage across canisters. |
| Separation of concerns | Auth service, content service, payment service as independent units. |
| Independent upgrades | Upgrade the payments canister without touching the user canister. |
| Access control | Different controllers for different canisters (e.g., DAO controls one, team controls another). |
| Scaling reads | Multiple query canisters serving the same data for throughput. |

**When NOT to use:** Simple apps with <1GB data. Single-canister is simpler, faster, and avoids inter-canister call overhead. Do not over-architect.

## Mistakes That Break Your Build

1. **`ic_cdk::api::msg_caller()` changes after `await` in Rust (CRITICAL).** In Rust, `ic_cdk::api::msg_caller()` returns the **callee** principal after an `await` point, not the original caller. Always capture the caller into a variable BEFORE any `await`. **Motoko is safe:** `public shared ({ caller }) func` captures `caller` as an immutable binding at function entry -- it does NOT change after await.

    ```rust
    // WRONG (Rust) — caller() is wrong after await:
    #[update]
    async fn do_thing() {
        let _ = some_canister_call().await;
        let who = ic_cdk::api::msg_caller(); // THIS IS NOW THE CALLEE, NOT THE ORIGINAL CALLER
    }

    // CORRECT (Rust) — capture before await:
    #[update]
    async fn do_thing() {
        let original_caller = ic_cdk::api::msg_caller(); // Capture BEFORE await
        let _ = some_canister_call().await;
        let who = original_caller; // Safe
    }
    ```

2. **Circular inter-canister calls deadlock.** If canister A calls canister B, and B calls A in the same call chain, it deadlocks. The IC has no deadlock detection. Design call graphs as DAGs (directed acyclic graphs).

3. **Inter-canister calls are NOT atomic.** If canister A updates its state, then calls canister B, and B traps, A's state change is already committed. You cannot roll back. Design for eventual consistency or use a saga pattern.

4. **Not handling rejected calls.** Inter-canister calls can fail (callee trapped, out of cycles, canister stopped). In Motoko use `try/catch`. In Rust, handle the `Result` from `ic_cdk::call`. Unhandled rejections trap your canister.

5. **Deploying canisters in the wrong order.** Canisters with dependencies must be deployed after their dependencies. Declare `dependencies` in icp.yaml so `icp deploy` orders them correctly.

6. **Forgetting to generate type declarations for each backend canister.** Use language-specific tooling (e.g., `didc` for Candid bindings) to generate declarations for each backend canister individually.

7. **Shared types diverging between canisters.** If canister A expects `{ id: Nat; name: Text }` and canister B sends `{ id: Nat; title: Text }`, the call silently fails or traps. Use a shared types module imported by both canisters.

8. **Canister factory without enough cycles.** Creating a canister requires cycles. The management canister charges for creation and the initial cycle balance. If you do not attach enough, creation fails.

9. **`canister_inspect_message` does not run for inter-canister calls.** It only runs for ingress messages (from external users). Do not rely on it for access control between canisters. Use explicit principal checks instead.

10. **Not setting up `#[init]` and `#[post_upgrade]` in Rust.** Without a `post_upgrade` handler, canister upgrades may behave unexpectedly. Always define both.

## Implementation

### Project Structure

```
my-project/
  icp.yaml
  mops.toml
  src/
    shared/
      Types.mo          # Shared type definitions
    user_service/
      main.mo           # User canister
    content_service/
      main.mo           # Content canister
    frontend/
      ...               # Frontend assets
```

### icp.yaml

```yaml
defaults:
  build:
    packtool: mops sources
canisters:
  user_service:
    type: motoko
    main: src/user_service/main.mo
  content_service:
    type: motoko
    main: src/content_service/main.mo
    dependencies:
      - user_service
  frontend:
    type: assets
    source:
      - dist
    dependencies:
      - user_service
      - content_service
networks:
  local:
    bind: 127.0.0.1:4943
```

### Motoko

#### src/shared/Types.mo — Shared Types

```motoko
module {
  public type UserId = Principal;
  public type PostId = Nat;

  public type UserProfile = {
    id : UserId;
    username : Text;
    created : Int;
  };

  public type Post = {
    id : PostId;
    author : UserId;
    title : Text;
    body : Text;
    created : Int;
  };

  public type ServiceError = {
    #NotFound;
    #Unauthorized;
    #AlreadyExists;
    #InternalError : Text;
  };
};
```

#### src/user_service/main.mo — User Canister

```motoko
import Map "mo:core/Map";
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Result "mo:core/Result";
import Runtime "mo:core/Runtime";
import Types "../shared/Types";

persistent actor {

  type UserProfile = Types.UserProfile;

  let users = Map.empty<Principal, UserProfile>();

  // Register a new user
  public shared ({ caller }) func register(username : Text) : async Result.Result<UserProfile, Types.ServiceError> {
    if (Principal.isAnonymous(caller)) {
      return #err(#Unauthorized);
    };
    switch (Map.get(users, Principal.compare, caller)) {
      case (?_existing) { #err(#AlreadyExists) };
      case null {
        let profile : UserProfile = {
          id = caller;
          username;
          created = Time.now();
        };
        Map.add(users, Principal.compare, caller, profile);
        #ok(profile)
      };
    }
  };

  // Check if a user exists (called by other canisters)
  public shared query func isValidUser(userId : Principal) : async Bool {
    switch (Map.get(users, Principal.compare, userId)) {
      case (?_) { true };
      case null { false };
    }
  };

  // Get user profile
  public shared query func getUser(userId : Principal) : async ?UserProfile {
    Map.get(users, Principal.compare, userId)
  };

  // Get all users
  public query func getUsers() : async [UserProfile] {
    Array.fromIter<UserProfile>(Map.values(users))
  };
};
```

#### src/content_service/main.mo — Content Canister (calls User Service)

```motoko
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Array "mo:core/Array";
import Time "mo:core/Time";
import Result "mo:core/Result";
import Runtime "mo:core/Runtime";
import Error "mo:core/Error";
import Principal "mo:core/Principal";
import Types "../shared/Types";

// Import the other canister — name must match icp.yaml canister key
import UserService "canister:user_service";

persistent actor {

  type Post = Types.Post;

  let posts = Map.empty<Nat, Post>();
  var postCounter : Nat = 0;

  // Create a post — validates user via inter-canister call
  public shared ({ caller }) func createPost(title : Text, body : Text) : async Result.Result<Post, Types.ServiceError> {
    // CRITICAL: capture caller BEFORE any await
    let originalCaller = caller;

    if (Principal.isAnonymous(originalCaller)) {
      return #err(#Unauthorized);
    };

    // Inter-canister call to user_service
    let isValid = try {
      await UserService.isValidUser(originalCaller)
    } catch (e : Error.Error) {
      Runtime.trap("User service unavailable: " # Error.message(e));
    };

    if (not isValid) {
      return #err(#Unauthorized);
    };

    let id = postCounter;
    let post : Post = {
      id;
      author = originalCaller; // Use captured caller, NOT caller
      title;
      body;
      created = Time.now();
    };
    Map.add(posts, Nat.compare, id, post);
    postCounter += 1;
    #ok(post)
  };

  // Get all posts
  public query func getPosts() : async [Post] {
    Array.fromIter<Post>(Map.values(posts))
  };

  // Get posts by author — with enriched user data
  public func getPostsWithAuthor(authorId : Principal) : async {
    user : ?Types.UserProfile;
    posts : [Post];
  } {
    let userProfile = try {
      await UserService.getUser(authorId)
    } catch (_e : Error.Error) { null };

    let authorPosts = Array.filter<Post>(
      Array.fromIter<Post>(Map.values(posts)),
      func(p : Post) : Bool { p.author == authorId }
    );

    { user = userProfile; posts = authorPosts }
  };

  // Delete a post — only the author can delete
  public shared ({ caller }) func deletePost(id : Nat) : async Result.Result<(), Types.ServiceError> {
    let originalCaller = caller;

    switch (Map.get(posts, Nat.compare, id)) {
      case (?post) {
        if (post.author != originalCaller) {
          return #err(#Unauthorized);
        };
        ignore Map.delete(posts, Nat.compare, id);
        #ok(())
      };
      case null { #err(#NotFound) };
    }
  };
};
```

### Rust

#### Project Structure (Rust)

```
my-project/
  icp.yaml
  Cargo.toml          # workspace
  src/
    user_service/
      Cargo.toml
      src/lib.rs
    content_service/
      Cargo.toml
      src/lib.rs
```

#### Cargo.toml (workspace root)

```toml
[workspace]
members = [
  "src/user_service",
  "src/content_service",
]
```

#### icp.yaml (Rust)

```yaml
canisters:
  user_service:
    type: rust
    package: user_service
    candid: src/user_service/user_service.did
  content_service:
    type: rust
    package: content_service
    candid: src/content_service/content_service.did
    dependencies:
      - user_service
  frontend:
    type: assets
    source:
      - dist
    dependencies:
      - user_service
      - content_service
networks:
  local:
    bind: 127.0.0.1:4943
```

#### src/user_service/Cargo.toml

```toml
[package]
name = "user_service"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.19"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
ic-stable-structures = "0.7"
```

#### src/user_service/src/lib.rs

```rust
use candid::{CandidType, Deserialize, Principal};
use ic_cdk::{init, post_upgrade, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone, Debug)]
struct UserProfile {
    id: Principal,
    username: String,
    created: i64,
}

// Stable storage
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    static USERS: RefCell<StableBTreeMap<Vec<u8>, Vec<u8>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );
}

fn principal_to_key(p: &Principal) -> Vec<u8> {
    p.as_slice().to_vec()
}

fn serialize_profile(profile: &UserProfile) -> Vec<u8> {
    candid::encode_one(profile).unwrap()
}

fn deserialize_profile(bytes: &[u8]) -> UserProfile {
    candid::decode_one(bytes).unwrap()
}

#[init]
fn init() {}

#[post_upgrade]
fn post_upgrade() {}

#[update]
fn register(username: String) -> Result<UserProfile, String> {
    let caller = ic_cdk::api::msg_caller();
    if caller == Principal::anonymous() {
        return Err("Unauthorized".to_string());
    }

    let key = principal_to_key(&caller);
    USERS.with(|users| {
        if users.borrow().contains_key(&key) {
            return Err("Already exists".to_string());
        }

        let profile = UserProfile {
            id: caller,
            username,
            created: ic_cdk::api::time() as i64,
        };
        let bytes = serialize_profile(&profile);
        users.borrow_mut().insert(key, bytes);
        Ok(profile)
    })
}

#[query]
fn is_valid_user(user_id: Principal) -> bool {
    let key = principal_to_key(&user_id);
    USERS.with(|users| users.borrow().contains_key(&key))
}

#[query]
fn get_user(user_id: Principal) -> Option<UserProfile> {
    let key = principal_to_key(&user_id);
    USERS.with(|users| {
        users.borrow().get(&key).map(|bytes| deserialize_profile(&bytes))
    })
}

ic_cdk::export_candid!();
```

#### src/content_service/Cargo.toml

```toml
[package]
name = "content_service"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.19"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
ic-stable-structures = "0.7"
```

#### src/content_service/src/lib.rs

```rust
use candid::{CandidType, Deserialize, Principal};
use ic_cdk::call::Call;
use ic_cdk::{init, post_upgrade, query, update};
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap, StableCell};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

#[derive(CandidType, Deserialize, Clone, Debug)]
struct Post {
    id: u64,
    author: Principal,
    title: String,
    body: String,
    created: i64,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
struct UserProfile {
    id: Principal,
    username: String,
    created: i64,
}

// Stable storage -- survives canister upgrades
thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Posts keyed by id (u64 as big-endian bytes) -> candid-encoded Post
    static POSTS: RefCell<StableBTreeMap<Vec<u8>, Vec<u8>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );

    // Post counter in stable memory
    static POST_COUNTER: RefCell<StableCell<u64, Memory>> = RefCell::new(
        StableCell::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(1))),
            0u64,
        )
    );

    // Store the user_service canister ID (set during init, re-set on upgrade)
    static USER_SERVICE_ID: RefCell<Option<Principal>> = RefCell::new(None);
}

fn post_id_to_key(id: u64) -> Vec<u8> {
    id.to_be_bytes().to_vec()
}

fn serialize_post(post: &Post) -> Vec<u8> {
    candid::encode_one(post).unwrap()
}

fn deserialize_post(bytes: &[u8]) -> Post {
    candid::decode_one(bytes).unwrap()
}

#[init]
fn init(user_service_id: Principal) {
    USER_SERVICE_ID.with(|id| *id.borrow_mut() = Some(user_service_id));
}

#[post_upgrade]
fn post_upgrade(user_service_id: Principal) {
    // Re-set the user_service ID (not stored in stable memory for simplicity,
    // since it is always passed as an init/upgrade argument)
    init(user_service_id);
}

fn get_user_service_id() -> Principal {
    USER_SERVICE_ID.with(|id| {
        id.borrow().expect("user_service canister ID not set")
    })
}

// CRITICAL: capture caller BEFORE any await
#[update]
async fn create_post(title: String, body: String) -> Result<Post, String> {
    // Capture caller BEFORE the await -- caller() is wrong after await
    let original_caller = ic_cdk::api::msg_caller();

    if original_caller == Principal::anonymous() {
        return Err("Unauthorized".to_string());
    }

    // Inter-canister call to user_service
    let user_service = get_user_service_id();
    let (is_valid,): (bool,) = Call::unbounded_wait(user_service, "is_valid_user")
        .with_arg(original_caller)
        .await
        .map_err(|e| format!("User service call failed: {:?}", e))?
        .candid()
        .map_err(|e| format!("Failed to decode response: {:?}", e))?;

    if !is_valid {
        return Err("User not registered".to_string());
    }

    let id = POST_COUNTER.with(|counter| {
        let mut counter = counter.borrow_mut();
        let id = *counter.get();
        counter.set(id + 1);
        id
    });

    let post = Post {
        id,
        author: original_caller, // Use captured caller
        title,
        body,
        created: ic_cdk::api::time() as i64,
    };

    POSTS.with(|posts| {
        posts.borrow_mut().insert(post_id_to_key(id), serialize_post(&post));
    });

    Ok(post)
}

#[query]
fn get_posts() -> Vec<Post> {
    POSTS.with(|posts| {
        posts.borrow().iter()
            .map(|entry| deserialize_post(&entry.value()))
            .collect()
    })
}

// Cross-canister enrichment: get posts with author profile
#[update]
async fn get_posts_with_author(author_id: Principal) -> (Option<UserProfile>, Vec<Post>) {
    let user_service = get_user_service_id();

    // Call user_service for profile data
    let user_profile: Option<UserProfile> =
        match Call::unbounded_wait(user_service, "get_user")
            .with_arg(author_id)
            .await
        {
            Ok(response) => response.candid::<(Option<UserProfile>,)>()
                .map(|(profile,)| profile)
                .unwrap_or(None),
            Err(_) => None, // Handle gracefully if user service is down
        };

    let author_posts = POSTS.with(|posts| {
        posts.borrow().iter()
            .map(|entry| deserialize_post(&entry.value()))
            .filter(|p| p.author == author_id)
            .collect()
    });

    (user_profile, author_posts)
}

#[update]
async fn delete_post(id: u64) -> Result<(), String> {
    let original_caller = ic_cdk::api::msg_caller();

    POSTS.with(|posts| {
        let mut posts = posts.borrow_mut();
        let key = post_id_to_key(id);
        match posts.get(&key) {
            Some(bytes) => {
                let post = deserialize_post(&bytes);
                if post.author != original_caller {
                    return Err("Unauthorized".to_string());
                }
                posts.remove(&key);
                Ok(())
            }
            None => Err("Not found".to_string()),
        }
    })
}

ic_cdk::export_candid!();
```

### Canister Factory Pattern

A canister that creates other canisters dynamically. Useful for per-user canisters, sharding, or dynamic scaling.

#### Motoko Factory

```motoko
import Principal "mo:core/Principal";
import Map "mo:core/Map";
import Array "mo:core/Array";
import Runtime "mo:core/Runtime";

persistent actor Self {

  type CanisterSettings = {
    controllers : ?[Principal];
    compute_allocation : ?Nat;
    memory_allocation : ?Nat;
    freezing_threshold : ?Nat;
  };

  type CreateCanisterResult = {
    canister_id : Principal;
  };

  // IC Management canister
  transient let ic : actor {
    create_canister : shared ({ settings : ?CanisterSettings }) -> async CreateCanisterResult;
    install_code : shared ({
      mode : { #install; #reinstall; #upgrade };
      canister_id : Principal;
      wasm_module : Blob;
      arg : Blob;
    }) -> async ();
    deposit_cycles : shared ({ canister_id : Principal }) -> async ();
  } = actor "aaaaa-aa";

  // Track created canisters
  let childCanisters = Map.empty<Principal, Principal>(); // owner -> canister

  // Create a new canister for a user
  public shared ({ caller }) func createChildCanister(wasmModule : Blob) : async Principal {
    if (Principal.isAnonymous(caller)) { Runtime.trap("Auth required") };

    // Create canister with cycles
    let createResult = await (with cycles = 1_000_000_000_000)
      ic.create_canister({
        settings = ?{
          controllers = ?[Principal.fromActor(Self), caller];
          compute_allocation = null;
          memory_allocation = null;
          freezing_threshold = null;
        };
      });

    let canisterId = createResult.canister_id;

    // Install code
    await ic.install_code({
      mode = #install;
      canister_id = canisterId;
      wasm_module = wasmModule;
      arg = to_candid (caller); // Pass owner as init arg
    });

    Map.add(childCanisters, Principal.compare, caller, canisterId);
    canisterId
  };

  // Get a user's canister
  public query func getChildCanister(owner : Principal) : async ?Principal {
    Map.get(childCanisters, Principal.compare, owner)
  };
};
```

#### Rust Factory

```rust
use candid::{CandidType, Deserialize, Nat, Principal, encode_one};
use ic_cdk::management_canister::{
    create_canister_with_extra_cycles, install_code,
    CreateCanisterArgs, InstallCodeArgs, CanisterInstallMode, CanisterSettings,
};
use ic_cdk::update;
use ic_stable_structures::memory_manager::{MemoryId, MemoryManager, VirtualMemory};
use ic_stable_structures::{DefaultMemoryImpl, StableBTreeMap};
use std::cell::RefCell;

type Memory = VirtualMemory<DefaultMemoryImpl>;

thread_local! {
    static MEMORY_MANAGER: RefCell<MemoryManager<DefaultMemoryImpl>> =
        RefCell::new(MemoryManager::init(DefaultMemoryImpl::default()));

    // Stable storage: owner principal -> child canister principal (survives upgrades)
    static CHILD_CANISTERS: RefCell<StableBTreeMap<Vec<u8>, Vec<u8>, Memory>> = RefCell::new(
        StableBTreeMap::init(
            MEMORY_MANAGER.with(|m| m.borrow().get(MemoryId::new(0)))
        )
    );
}

#[update]
async fn create_child_canister(wasm_module: Vec<u8>) -> Principal {
    let caller = ic_cdk::api::msg_caller();
    assert_ne!(caller, Principal::anonymous(), "Auth required");

    // Create canister
    let create_args = CreateCanisterArgs {
        settings: Some(CanisterSettings {
            controllers: Some(vec![ic_cdk::api::canister_self(), caller]),
            compute_allocation: None,
            memory_allocation: None,
            freezing_threshold: None,
            reserved_cycles_limit: None,
            log_visibility: None,
            wasm_memory_limit: None,
            wasm_memory_threshold: None,
            environment_variables: None,
        }),
    };

    // Attach 1T cycles for the new canister
    let create_result = create_canister_with_extra_cycles(&create_args, 1_000_000_000_000u128)
        .await
        .expect("Failed to create canister");

    let canister_id = create_result.canister_id;

    // Install code
    let install_args = InstallCodeArgs {
        mode: CanisterInstallMode::Install,
        canister_id,
        wasm_module,
        arg: encode_one(&caller).unwrap(), // Pass owner as init arg
    };

    install_code(&install_args)
        .await
        .expect("Failed to install code");

    // Track the child canister
    CHILD_CANISTERS.with(|canisters| {
        canisters.borrow_mut().insert(
            caller.as_slice().to_vec(),
            canister_id.as_slice().to_vec(),
        );
    });

    canister_id
}

#[ic_cdk::query]
fn get_child_canister(owner: Principal) -> Option<Principal> {
    CHILD_CANISTERS.with(|canisters| {
        canisters.borrow().get(&owner.as_slice().to_vec())
            .map(|bytes| Principal::from_slice(&bytes))
    })
}
```

## Upgrade Strategy for Multi-Canister Systems

### Ordering

1. Deploy shared dependencies first (e.g., user_service before content_service).
2. Never change Candid interfaces in a breaking way. Add new fields as `opt` types.
3. Test upgrades locally before mainnet.

### Safe Upgrade Checklist

- Never remove or rename fields in existing types shared across canisters.
- Add new fields as optional (`?Type` in Motoko, `Option<T>` in Rust).
- If a canister's Candid interface changes, upgrade consumers after the provider.
- Always have both `#[init]` and `#[post_upgrade]` in Rust canisters.
- In Motoko, `persistent actor` handles stable storage automatically.

### Upgrade Commands

```bash
# Upgrade canisters in dependency order
icp deploy user_service

# Rust content_service requires the user_service principal on every upgrade (post_upgrade arg)
USER_SERVICE_ID=$(icp canister id user_service)
icp deploy content_service --argument "(principal \"$USER_SERVICE_ID\")"

npm run build
icp deploy frontend
```

## Deploy & Test

### Local Development

```bash
# Start the local replica
icp network start -d

# Deploy in dependency order
icp deploy user_service

# content_service (Rust) requires the user_service canister ID as an init argument
USER_SERVICE_ID=$(icp canister id user_service)
icp deploy content_service --argument "(principal \"$USER_SERVICE_ID\")"

# Build and deploy frontend
npm run build
icp deploy frontend
```

### Test Inter-Canister Calls (Motoko)

```bash
# Register a user
PRINCIPAL=$(icp identity principal)
icp canister call user_service register "(\"alice\")"

# Verify user exists
icp canister call user_service isValidUser "(principal \"$PRINCIPAL\")"
# Expected: (true)

# Create a post (triggers inter-canister call to user_service)
icp canister call content_service createPost "(\"Hello World\", \"My first post\")"
# Expected: (variant { ok = record { id = 0; author = principal "..."; ... } })

# Get all posts
icp canister call content_service getPosts
# Expected: (vec { record { id = 0; ... } })
```

### Test Inter-Canister Calls (Rust)

Rust canisters use snake_case function names:

```bash
PRINCIPAL=$(icp identity principal)
icp canister call user_service register "(\"alice\")"

icp canister call user_service is_valid_user "(principal \"$PRINCIPAL\")"
# Expected: (true)

# content_service must have been deployed with --argument "(principal \"<user_service_id>\")"
icp canister call content_service create_post "(\"Hello World\", \"My first post\")"
# Expected: (variant { ok = record { id = 0 : nat64; author = principal "..."; ... } })

icp canister call content_service get_posts
# Expected: (vec { record { id = 0 : nat64; ... } })
```

## Verify It Works

### Verify User Registration

```bash
icp canister call user_service register '("testuser")'
# Expected: (variant { ok = record { id = principal "..."; username = "testuser"; created = ... } })
```

### Verify Inter-Canister Call

```bash
# This call should succeed (user is registered)
# Motoko: createPost / Rust: create_post
icp canister call content_service createPost '("Test Title", "Test Body")'
# Expected: (variant { ok = record { ... } })

# Create a new identity that is NOT registered
icp identity new unregistered --storage plaintext
icp identity use unregistered
icp canister call content_service createPost '("Should Fail", "No user")'
# Expected: (variant { err = "User not registered" })

# Switch back
icp identity use default
```

### Verify Cross-Canister Query

```bash
PRINCIPAL=$(icp identity principal)
# Motoko: getPostsWithAuthor / Rust: get_posts_with_author
icp canister call content_service getPostsWithAuthor "(principal \"$PRINCIPAL\")"
# Expected: (opt record { id = ...; username = "testuser"; ... }, vec { record { ... } })
```

### Verify Canister Factory

```bash
# Read the wasm file for the child canister
# (In practice you'd upload or reference a wasm blob)
icp canister call factory createChildCanister '(blob "...")'
# Expected: (principal "NEW-CANISTER-ID")

icp canister call factory getChildCanister "(principal \"$PRINCIPAL\")"
# Expected: (opt principal "NEW-CANISTER-ID")
```
