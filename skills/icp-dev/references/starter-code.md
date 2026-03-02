# ICP Starter Code Templates

## Project Setup

Every ICP project starts with an `icp.yaml` configuration file:

```yaml
canisters:
  backend:
    type: motoko
    main: src/backend/main.mo
  frontend:
    type: assets
    source: dist
```

For Rust canisters, change the type:

```yaml
canisters:
  backend:
    type: rust
    candid: src/backend/backend.did
    package: backend
```

## Motoko Starter

```motoko
import Principal "mo:core/Principal";
import Debug "mo:core/Debug";

persistent actor {
  stable var counter : Nat = 0;

  public func increment() : async Nat {
    counter += 1;
    counter;
  };

  public query func get() : async Nat {
    counter;
  };
};
```

## Rust Starter

```toml
[package]
name = "backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
ic-cdk = "0.19"
candid = "0.10"
serde = { version = "1", features = ["derive"] }
```

```rust
use ic_cdk::{query, update};
use std::cell::RefCell;

thread_local! {
    static COUNTER: RefCell<u64> = RefCell::new(0);
}

#[update]
fn increment() -> u64 {
    COUNTER.with(|c| {
        let mut count = c.borrow_mut();
        *count += 1;
        *count
    })
}

#[query]
fn get() -> u64 {
    COUNTER.with(|c| *c.borrow())
}

ic_cdk::export_candid!();
```
