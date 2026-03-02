---
name: icp-dev
title: ICP Development
category: Infrastructure
description: "Master skill for Internet Computer development. Routes to specialized skills for ckBTC, authentication, multi-canister patterns, and more. Load this first when building ICP applications."
endpoints: 13
version: 1.2.0
status: stable
dependencies: []
requires: [icp-cli >= 0.1.0]
tags: [icp, internet-computer, canister, dfx, motoko, rust, development, meta]
---

# ICP Development

## What This Is

A meta-skill that acts as the single entry point for all Internet Computer development. Instead of loading all 13 ICP skills at once, load this skill first — it categorizes every available skill by domain and priority, then tells you exactly which specialized skills to load for your specific task. Each referenced skill is a separate file you load on demand.

## Prerequisites

- `icp-cli` >= 0.1.0 (`brew install icp-cli`)
- `ic-wasm` (`brew install ic-wasm`)
- For Motoko canisters: `mops` package manager
- For Rust canisters: `cargo` with `wasm32-unknown-unknown` target (`rustup target add wasm32-unknown-unknown`)
- For frontend: Node.js >= 18

## Reference Directory

| Priority | Reference | Description |
|----------|-------|-------------|
| CRITICAL | [multi-canister](references/multi-canister.md) | Multi-canister design, inter-canister calls, shared state, upgrade strategies |
| CRITICAL | [stable-memory](references/stable-memory.md) | State across upgrades, stable structures, pre/post upgrade hooks, memory-mapped data |
| HIGH | [internet-identity](references/internet-identity.md) | Internet Identity auth, delegation, session management, anchor handling |
| HIGH | [vetkd](references/vetkd.md) | On-chain privacy with vetKeys, key derivation, encryption/decryption, access control |
| HIGH | [certified-variables](references/certified-variables.md) | Verified query responses, Merkle tree construction, certificate validation |
| HIGH | [ckbtc](references/ckbtc.md) | ckBTC minting, transfers, balance checks, UTXO management |
| HIGH | [icrc-ledger](references/icrc-ledger.md) | ICRC-1/ICRC-2 token ledgers, minting, approvals, transfers, metadata |
| HIGH | [wallet](references/wallet.md) | Cycles wallets, canister top-up, cycle management |
| MEDIUM | [https-outcalls](references/https-outcalls.md) | HTTP requests from canisters, consensus-safe patterns, transform functions |
| MEDIUM | [evm-rpc](references/evm-rpc.md) | Ethereum/EVM calls from IC, JSON-RPC, transaction signing, cross-chain workflows |
| MEDIUM | [asset-canister](references/asset-canister.md) | Frontend assets on IC, certified assets, custom domains, SPA routing |
| MEDIUM | [ic-dashboard](references/ic-dashboard.md) | Public REST APIs for canister, ledger, SNS, and metrics data |
| LOW | [sns-launch](references/sns-launch.md) | SNS DAO launch, token economics, proposal types, decentralization swap |


## Mistakes That Break Your Build

These are universal ICP pitfalls that apply across multiple skills. Each specialized skill has its own pitfalls section — load the relevant skill for domain-specific pitfalls.

1. **Forgetting to start the local replica.** All `icp canister call` and `icp deploy` commands require a running replica. Run `icp network start -d` first. If commands hang or fail with connection errors, check that the replica is running.

2. **Using `async` inter-canister calls in `init` or `pre_upgrade`.** These hooks run synchronously. Any `await` in them will trap. Move async initialization to a separate `post_deploy` or `setup` method that you call after deployment.

3. **Ignoring cycle costs.** Every canister operation consumes cycles. Canisters that run out of cycles are deleted after 30 days. Always set up monitoring (see [ic-dashboard](references/ic-dashboard.md)) and fund canisters with sufficient cycles (see [wallet](references/wallet.md)).

4. **Hardcoding canister IDs.** Canister IDs differ between local and mainnet deployments. Use environment-based configuration or the canister ID resolution built into `icp-cli` instead of hardcoded principals.

5. **Not testing upgrades.** Deploy, store data, upgrade, and verify data survives. Many bugs only surface during upgrades. Load [stable-memory](references/stable-memory.md) for the full upgrade safety patterns.

6. **Exceeding the 2 MB ingress message limit.** Both call arguments and return values must stay under 2 MB. For large data, use chunked upload/download patterns or store data in stable memory and return references.

7. **Misunderstanding query vs. update calls.** Query calls are fast (~200ms) but not consensus-verified and cannot modify state. Update calls go through consensus (~2s) and can modify state. Use queries for reads, updates for writes. To prove query results, load [certified-variables](references/certified-variables.md).

## Implementation

For project setup templates (icp.yaml, Motoko, Rust), see [starter-code](references/starter-code.md).

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
