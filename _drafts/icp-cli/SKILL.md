---
name: icp-cli
description: "Manages ICP project lifecycle with the icp command-line tool. Covers project creation, recipe-based canister configuration, environment management, canister deployment, and identity handling. Use when setting up projects, deploying canisters, or managing local/mainnet environments. Do NOT use for canister-level programming patterns."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.0"
metadata:
  title: ICP CLI
  category: Infrastructure
  version: 1.0.0
  status: stable
  dependencies: ""
---

# ICP CLI

## What This Is

The `icp` CLI (successor to `dfx`) manages the full lifecycle of Internet Computer projects: creating projects from templates, running local networks, deploying canisters, and managing identities and cycles. It uses `icp.yaml` for configuration instead of the legacy `dfx.json`. Environments are first-class concepts that combine network, canister selection, and per-canister settings into deployment targets. Canister build configuration uses versioned recipes from a registry rather than hardcoded canister types.

## Prerequisites

- `icp-cli` >= 0.2.0 (`npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm`) — docs: [cli.icp.build](https://cli.icp.build)

## Mistakes That Break Your Build

1. **Using `dfx` commands.** The `icp` CLI replaces `dfx` with different syntax:
   - `dfx deploy --network ic` → `icp deploy -e ic`
   - `dfx start --background` → `icp network start -d`
   - `dfx identity use` → `icp identity default`
   - `dfx identity get-principal` → `icp identity principal`
   - `dfx canister deposit-cycles` → `icp canister top-up`
   - `dfx.json` → `icp.yaml`

   Never generate `dfx` commands. If you see existing `dfx.json` config, the project needs migration to `icp.yaml`.

2. **Confusing environments with networks.** An **environment** (`-e`) is a deployment target combining a network + canister list + settings. A **network** is the underlying infrastructure (managed local replica or connected external endpoint). Two implicit environments always exist: `local` (managed local network) and `ic` (IC mainnet). Use `-e` for deployment. You almost never need to specify a network directly.

3. **Using a recipe without a version.** Recipe versions are **mandatory**. An unpinned recipe will not resolve:
   ```yaml
   # Correct — pinned version
   recipe:
     type: "@dfinity/rust@v3.0.0"

   # Wrong — will fail
   recipe:
     type: "@dfinity/rust"
   ```
   Official recipes are hosted at [dfinity/icp-cli-recipes](https://github.com/dfinity/icp-cli-recipes).

4. **Running `icp network start --clean` without expecting data loss.** `--clean` wipes ALL local state including canister IDs. Every canister must be redeployed. Only use when you intentionally want a blank slate.

5. **Hardcoding canister IDs.** Canister IDs are managed per environment. Managed networks (local) store IDs in `.icp/cache/mappings/<env>.ids.json` (ephemeral — deleted when network stops). Connected networks (mainnet) store IDs in `.icp/data/mappings/<env>.ids.json` (persistent). **Commit `.icp/data/` to source control** — losing it means losing track of deployed mainnet canisters.

6. **Deploying to mainnet without checking cycles.** Canister creation costs ~2T cycles by default. Check balance with `icp cycles balance -e ic`. A canister that runs out of cycles freezes and eventually gets deleted — see [canister-security](../canister-security/SKILL.md) for freezing threshold configuration.

7. **Forgetting to start the local network.** `icp deploy` without a running local network gives a confusing connection error. Run `icp network start -d` first (`-d` for background mode). Note: local networks are **project-specific** (unlike dfx which shared one network across projects).

8. **Using `dfx.json` structure in `icp.yaml`.** The formats differ significantly: canisters are an array (not an object), recipes replace canister types, and environments/networks are explicit top-level sections. Use `icp project show` to view the effective configuration after recipe expansion and validate your config is correct.

## Implementation

### Project Creation

```bash
# Create a project interactively (prompts for template, language, network type)
icp new my-project

# Create non-interactively with template and options
icp new my-project --subfolder hello-world \
  --define backend_type=motoko \
  --define frontend_type=react \
  --define network_type=Default
```

Templates are sourced from [dfinity/icp-cli-templates](https://github.com/dfinity/icp-cli-templates).

### icp.yaml Configuration

```yaml
canisters:
  # Rust canister using a registry recipe (version mandatory)
  - name: backend
    recipe:
      type: "@dfinity/rust@v3.0.0"
      configuration:
        package: backend
        candid: "src/backend/backend.did"

  # Asset canister for frontend
  - name: frontend
    recipe:
      type: "@dfinity/asset-canister@v2.1.0"
      configuration:
        dir: dist
        build:
          - npm install
          - npm run build

# Optional: custom environments
environments:
  - name: staging
    network: ic
    canisters: [backend]
    settings:
      backend:
        compute_allocation: 5

# Optional: custom networks
networks:
  - name: local
    mode: managed
    ii: true          # Enable local Internet Identity
    nns: true         # Enable local NNS/SNS
```

Validate configuration: `icp project show` — displays the effective config after recipe expansion including implicit networks and environments.

### Environment Management

```bash
# Local development (implicit `local` environment — no flag needed)
icp deploy

# Mainnet (implicit `ic` environment)
icp deploy -e ic

# Custom environment
icp deploy -e staging
```

Settings cascade: environment-specific overrides > canister-level defaults > recipe defaults.

### Local Network

```bash
# Start in background
icp network start -d

# Check status
icp network status

# Stop
icp network stop

# Clean restart (destroys all local state!)
icp network stop
icp network start -d --clean
```

Local networks can enable Internet Identity (`ii: true`) and NNS/SNS canisters (`nns: true`). The anonymous identity is auto-funded with ICP and cycles on local networks — no wallet setup needed for local development.

### Canister Operations

```bash
# Deploy all canisters
icp deploy

# Deploy a specific canister
icp deploy backend

# Call a canister method (Candid arguments in parentheses)
icp canister call backend greet '("World")'

# Check canister status
icp canister settings show backend -e ic

# View canister logs
icp canister logs backend

# Update canister settings
icp canister settings update backend --freezing-threshold 2592000 -e ic

# Sync settings from icp.yaml to deployed canister
icp canister settings sync backend -e ic
```

### Identity Management

```bash
# Create a new identity (default storage: keyring)
icp identity new my-identity

# Set default identity
icp identity default my-identity

# Show current principal
icp identity principal

# Get account IDs (ICP ledger + ICRC-1)
icp identity account-id

# List all identities
icp identity list

# Export identity PEM
icp identity export my-identity
```

**Security**: Identity keys are stored in platform-specific directories (macOS: `~/Library/Application Support/org.dfinity.icp-cli/identity/`, Linux: `~/.local/share/icp-cli/identity/`). Never commit these to version control. See [canister-security](../canister-security/SKILL.md) for controller management and backup identity patterns.

### Cycles Management

```bash
# Check balance
icp cycles balance -e ic

# Convert ICP to cycles
icp cycles mint --icp 1.0 -e ic

# Or specify target cycles amount (auto-determines ICP needed)
icp cycles mint --cycles 10T -e ic

# Top up a canister
icp canister top-up backend 1T -e ic

# Transfer cycles to a principal
icp cycles transfer 1T <principal> -e ic
```

Amount suffixes: `k` = thousand, `m` = million, `b` = billion, `t` = trillion.

## Deploy & Test

### Local Development

```bash
# Start local network
icp network start -d

# Deploy all canisters
icp deploy

# Test a call
icp canister call backend greet '("World")'
```

### Mainnet Deployment

```bash
# 1. Verify identity
icp identity principal

# 2. Check cycles balance
icp cycles balance -e ic

# 3. Deploy
icp deploy -e ic

# 4. Verify deployment
icp canister settings show backend -e ic
```

## Verify It Works

```bash
# 1. Local network is running
icp network status
# Expected: Network status indicating running state

# 2. Configuration is valid
icp project show
# Expected: Full effective configuration with expanded recipes

# 3. Canister is deployed and running
icp canister settings show backend
# Expected: Status "Running", non-zero module hash

# 4. Canister responds to calls
icp canister call backend greet '("World")'
# Expected: ("Hello, World!") or similar response

# 5. Mainnet deployment (if applicable)
icp canister settings show backend -e ic
# Expected: Status "Running", controllers list includes your principal
```
