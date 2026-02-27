---
name: icp-dev
title: ICP Development
category: Infrastructure
description: "Master skill for Internet Computer development. Routes to specialized skills for ckBTC, authentication, multi-canister patterns, and more. Load this first when building ICP applications."
endpoints: 13
version: 1.0.0
status: stable
dependencies: []
requires: [icp-cli >= 0.1.0]
tags: [icp, internet-computer, canister, dfx, motoko, rust, development, meta]
---

# ICP Development

## What This Is

A meta-skill that acts as the single entry point for all Internet Computer development. Instead of loading all 13 ICP skills at once, load this skill first — it categorizes every available skill by domain and priority, then tells you exactly which specialized skills to load for your specific task. Each referenced skill is a separate file you load on demand.

## Prerequisites

- `icp-cli` >= 0.1.0 (`brew install dfinity/tap/icp-cli`)
- For Motoko canisters: `mops` package manager
- For Rust canisters: `cargo` with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- For frontend: Node.js >= 18

## Skill Categories by Priority

| Priority | Category | Skills | When You Need Them |
|----------|----------|--------|--------------------|
| CRITICAL | Architecture | [multi-canister](../multi-canister/SKILL.md), [stable-memory](../stable-memory/SKILL.md) | Every non-trivial dapp needs these patterns |
| HIGH | Auth & Security | [internet-identity](../internet-identity/SKILL.md), [vetkd](../vetkd/SKILL.md), [certified-variables](../certified-variables/SKILL.md) | Most dapps need authentication or verified data |
| HIGH | DeFi & Tokens | [ckbtc](../ckbtc/SKILL.md), [icrc-ledger](../icrc-ledger/SKILL.md), [wallet](../wallet/SKILL.md) | Any dapp that handles tokens or payments |
| MEDIUM | Integration | [https-outcalls](../https-outcalls/SKILL.md), [evm-rpc](../evm-rpc/SKILL.md) | When calling external APIs or EVM chains |
| MEDIUM | Deployment | [asset-canister](../asset-canister/SKILL.md), [ic-dashboard](../ic-dashboard/SKILL.md) | Frontend hosting and canister monitoring |
| LOW | Governance | [sns-launch](../sns-launch/SKILL.md) | Only for DAO launches |

## Quick Reference

### Architecture (CRITICAL)

- **[multi-canister](../multi-canister/SKILL.md)** — Design and deploy multi-canister dapps with inter-canister calls, shared state patterns, and upgrade strategies.
- **[stable-memory](../stable-memory/SKILL.md)** — Manage canister state across upgrades. Stable structures, pre/post upgrade hooks, and memory-mapped data.

### Auth & Security (HIGH)

- **[internet-identity](../internet-identity/SKILL.md)** — Integrate Internet Identity authentication. Delegation, session management, and anchor handling.
- **[vetkd](../vetkd/SKILL.md)** — Implement on-chain privacy using vetKeys. Key derivation, encryption/decryption flows, and access control.
- **[certified-variables](../certified-variables/SKILL.md)** — Serve verified responses from query calls. Merkle tree construction and certificate validation.

### DeFi & Tokens (HIGH)

- **[ckbtc](../ckbtc/SKILL.md)** — Accept, send, and manage ckBTC. Minting, transfers, balance checks, and UTXO management.
- **[icrc-ledger](../icrc-ledger/SKILL.md)** — Deploy and interact with ICRC-1/ICRC-2 token ledgers. Minting, approvals, transfers, and metadata.
- **[wallet](../wallet/SKILL.md)** — Create, fund, and manage cycles wallets. Top-up canisters and automate cycle management.

### Integration (MEDIUM)

- **[https-outcalls](../https-outcalls/SKILL.md)** — Make HTTP requests from canisters to external APIs. Consensus-safe patterns and transform functions.
- **[evm-rpc](../evm-rpc/SKILL.md)** — Call Ethereum and EVM chains from IC canisters. JSON-RPC, transaction signing, and cross-chain workflows.

### Deployment (MEDIUM)

- **[asset-canister](../asset-canister/SKILL.md)** — Deploy frontend assets to the IC. Certified assets, custom domains, SPA routing, and content encoding.
- **[ic-dashboard](../ic-dashboard/SKILL.md)** — Use the public REST APIs from dashboard.internetcomputer.org for canister, ledger, SNS, and metrics data.

### Governance (LOW)

- **[sns-launch](../sns-launch/SKILL.md)** — Configure and launch an SNS DAO. Token economics, proposal types, and decentralization swap.

## Task Routing

Use this table to determine which skills to load for your specific task.

| Task | Load These Skills |
|------|-------------------|
| Build a DeFi app | [ckbtc](../ckbtc/SKILL.md), [icrc-ledger](../icrc-ledger/SKILL.md), [wallet](../wallet/SKILL.md), [internet-identity](../internet-identity/SKILL.md) |
| Add user authentication | [internet-identity](../internet-identity/SKILL.md), [asset-canister](../asset-canister/SKILL.md) |
| Call external APIs | [https-outcalls](../https-outcalls/SKILL.md) |
| Bridge to Ethereum | [evm-rpc](../evm-rpc/SKILL.md), [https-outcalls](../https-outcalls/SKILL.md) |
| Store large state | [stable-memory](../stable-memory/SKILL.md), [multi-canister](../multi-canister/SKILL.md) |
| Launch a DAO | [sns-launch](../sns-launch/SKILL.md), [icrc-ledger](../icrc-ledger/SKILL.md), [multi-canister](../multi-canister/SKILL.md) |
| Encrypt user data | [vetkd](../vetkd/SKILL.md), [internet-identity](../internet-identity/SKILL.md) |
| Prove query results | [certified-variables](../certified-variables/SKILL.md) |
| Deploy a frontend | [asset-canister](../asset-canister/SKILL.md) |
| Monitor canisters | [ic-dashboard](../ic-dashboard/SKILL.md) |
| Accept Bitcoin payments | [ckbtc](../ckbtc/SKILL.md), [icrc-ledger](../icrc-ledger/SKILL.md) |
| Create a custom token | [icrc-ledger](../icrc-ledger/SKILL.md) |
| Multi-canister architecture | [multi-canister](../multi-canister/SKILL.md), [stable-memory](../stable-memory/SKILL.md) |
| Survive canister upgrades | [stable-memory](../stable-memory/SKILL.md) |

## Mistakes That Break Your Build

These are universal ICP pitfalls that apply across multiple skills. Each specialized skill has its own pitfalls section — load the relevant skill for domain-specific pitfalls.

1. **Forgetting to start the local replica.** All `icp canister call` and `icp deploy` commands require a running replica. Run `icp network start -d` first. If commands hang or fail with connection errors, check that the replica is running.

2. **Using `async` inter-canister calls in `init` or `pre_upgrade`.** These hooks run synchronously. Any `await` in them will trap. Move async initialization to a separate `post_deploy` or `setup` method that you call after deployment.

3. **Ignoring cycle costs.** Every canister operation consumes cycles. Canisters that run out of cycles are deleted after 30 days. Always set up monitoring (see [ic-dashboard](../ic-dashboard/SKILL.md)) and fund canisters with sufficient cycles (see [wallet](../wallet/SKILL.md)).

4. **Hardcoding canister IDs.** Canister IDs differ between local and mainnet deployments. Use environment-based configuration or the canister ID resolution built into `icp-cli` instead of hardcoded principals.

5. **Not testing upgrades.** Deploy, store data, upgrade, and verify data survives. Many bugs only surface during upgrades. Load [stable-memory](../stable-memory/SKILL.md) for the full upgrade safety patterns.

6. **Exceeding the 2 MB ingress message limit.** Both call arguments and return values must stay under 2 MB. For large data, use chunked upload/download patterns or store data in stable memory and return references.

7. **Misunderstanding query vs. update calls.** Query calls are fast (~200ms) but not consensus-verified and cannot modify state. Update calls go through consensus (~2s) and can modify state. Use queries for reads, updates for writes. To prove query results, load [certified-variables](../certified-variables/SKILL.md).

## Implementation

### Project Setup

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

### Motoko Starter

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

### Rust Starter

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

## Deploy & Test

### Local Development

```bash
# Start local replica
icp network start -d

# Deploy all canisters
icp deploy

# Deploy a specific canister
icp deploy backend

# Call a canister method
icp canister call backend increment '()'

# Check canister status
icp canister status backend
```

### Mainnet Deployment

```bash
# Deploy to mainnet (requires cycles)
icp deploy backend -e ic

# Check mainnet canister status
icp canister status backend -e ic
```

## Verify It Works

```bash
# 1. Confirm replica is running
icp network status
# Expected: "Running" or network info output

# 2. Deploy and call the backend
icp deploy backend
icp canister call backend increment '()'
# Expected: (1 : nat) or (1 : nat64)

# 3. Verify state persists
icp canister call backend increment '()'
# Expected: (2 : nat) or (2 : nat64)

# 4. Check canister is healthy
icp canister status backend
# Expected: Status: Running, with cycles balance shown
```
