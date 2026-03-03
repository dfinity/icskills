---
name: icp-cli
description: "Guides use of the icp command-line tool for building and deploying Internet Computer applications. Covers project configuration (icp.yaml), recipes, environments, canister lifecycle, and identity management. Use when building, deploying, or managing any IC project. Use when the user mentions icp, dfx, canister deployment, local network, or project setup. Do NOT use for canister-level programming patterns like access control, inter-canister calls, or stable memory — use domain-specific skills instead."
license: Apache-2.0
metadata:
  title: ICP CLI
  category: Infrastructure
---

# ICP CLI

## What This Is

The `icp` command-line tool builds and deploys applications on the Internet Computer. It replaces the legacy `dfx` tool with YAML configuration, a recipe system for reusable build templates, and an environment model that separates deployment targets from network connections. Never use `dfx` — always use `icp`.

## Prerequisites

- For Rust canisters: `rustup target add wasm32-unknown-unknown`
- For Motoko canisters: `npm i -g ic-mops` and `moc` version defined in `mops.toml` (templates include this; for manual projects add `[toolchain]` with `moc = "<version>"`)
- For frontend assets: Node.js >= 20

## Common Pitfalls

1. **Using `dfx` instead of `icp`.** The `dfx` tool is legacy. All commands have `icp` equivalents — see the migration table below. Never generate `dfx` commands or reference `dfx` documentation. Configuration uses `icp.yaml`, not `dfx.json` — and the structure differs: canisters are an array of objects, not a keyed object.

2. **Using `--network ic` to deploy to mainnet.** icp-cli uses environments, not direct network targeting. The correct flag is `-e ic` (short for `--environment ic`).
   ```bash
   # Wrong
   icp deploy --network ic
   # Correct
   icp deploy -e ic
   ```
   Note: `-n` / `--network` targets a network directly and works with canister IDs (principals). Use `-e` / `--environment` when referencing canisters by name. For token and cycles operations, use `-n` since they don't reference project canisters.

3. **Using a recipe without a version pin.** Always pin recipe versions to avoid breaking changes. Unpinned recipes resolve to `latest` which can change at any time. Official recipes are hosted at [dfinity/icp-cli-recipes](https://github.com/dfinity/icp-cli-recipes).
   ```yaml
   # Wrong — unpinned, may break
   recipe:
     type: "@dfinity/rust"

   # Correct — pinned version
   recipe:
     type: "@dfinity/rust@v3.2.0"
   ```

4. **Writing manual build steps when a recipe exists.** Official recipes handle Rust, Motoko, and asset canister builds. Use them instead of writing shell commands:
   ```yaml
   # Unnecessary — use a recipe instead
   build:
     steps:
       - type: script
         commands:
           - cargo build --target wasm32-unknown-unknown --release
           - cp target/.../backend.wasm "$ICP_WASM_OUTPUT_PATH"

   # Preferred
   recipe:
     type: "@dfinity/rust@v3.2.0"
     configuration:
       package: backend
   ```

5. **Not committing `.icp/data/` to version control.** Mainnet canister IDs are stored in `.icp/data/mappings/<environment>.ids.json`. Losing this file means losing the mapping between canister names and on-chain IDs. Always commit `.icp/data/` — never delete it. Add `.icp/cache/` to `.gitignore` (it is ephemeral and rebuilt automatically).

6. **Using `icp identity use` instead of `icp identity default`.** The dfx command `dfx identity use` became `icp identity default`. Similarly, `dfx identity get-principal` became `icp identity principal`, and `dfx identity remove` became `icp identity delete`.

7. **Confusing networks and environments.** A network is a connection endpoint (URL). An environment combines a network + canisters + settings. You deploy to environments (`-e`), not networks. Multiple environments can target the same network with different settings (e.g., staging and production both on `ic`).

8. **Forgetting that local networks are project-local.** Unlike dfx which runs one shared global network, icp-cli runs a local network per project. You must run `icp network start -d` in your project directory before deploying locally. The local network auto-starts with system canisters and seeds accounts with ICP and cycles.

9. **Not specifying build commands for asset canisters.** dfx automatically runs `npm run build` for asset canisters. icp-cli requires explicit build commands in the recipe configuration:
    ```yaml
    canisters:
      - name: frontend
        recipe:
          type: "@dfinity/asset-canister@v2.1.0"
          configuration:
            dir: dist
            build:
              - npm install
              - npm run build
    ```

## How It Works

### Project Creation

`icp new` scaffolds projects from templates. Without flags, an interactive prompt launches. For scripted or non-interactive use, pass `--subfolder` and `--define` flags directly. Available templates and options: [dfinity/icp-cli-templates](https://github.com/dfinity/icp-cli-templates).

### Build → Deploy → Sync

```text
Source Code → [Build] → WASM → [Deploy] → Running Canister → [Sync] → Configured State
```

`icp deploy` runs all three phases in sequence:
1. **Build** — Compile canisters to WASM (via recipes or explicit build steps)
2. **Deploy** — Create canisters (if new), apply settings, install WASM
3. **Sync** — Post-deployment operations (e.g., upload assets to asset canisters)

Run phases separately for more control:
```bash
icp build                     # Build only
icp deploy                    # Full pipeline (build + deploy + sync)
icp sync my-canister          # Sync only (e.g., re-upload assets)
```

### Environments and Networks

Two implicit environments are always available:

| Environment | Network | Purpose |
|-------------|---------|---------|
| `local` | `local` (managed, localhost:8000) | Local development |
| `ic` | `ic` (connected, https://icp-api.io) | Mainnet production |

The `ic` network is protected and cannot be overridden.

Custom environments enable multiple deployment targets on the same network:

```yaml
environments:
  - name: staging
    network: ic
    canisters: [frontend, backend]
    settings:
      backend:
        compute_allocation: 5

  - name: production
    network: ic
    canisters: [frontend, backend]
    settings:
      backend:
        compute_allocation: 20
        freezing_threshold: 7776000
```

### Install Modes

```bash
icp deploy                    # Auto: install new, upgrade existing (default)
icp deploy --mode upgrade     # Preserve state, run upgrade hooks
icp deploy --mode reinstall   # Clear all state (dangerous)
```

## Configuration

### Rust canister

```yaml
canisters:
  - name: backend
    recipe:
      type: "@dfinity/rust@v3.2.0"
      configuration:
        package: backend
        candid: backend.did  # optional — if specified, file must exist (auto-generated when omitted)
```

### Motoko canister

```yaml
canisters:
  - name: backend
    recipe:
      type: "@dfinity/motoko@v4.1.0"
      configuration:
        main: src/backend/main.mo
        candid: backend.did  # optional — if specified, file must exist (auto-generated when omitted)
```

### Asset canister (frontend)

```yaml
canisters:
  - name: frontend
    recipe:
      type: "@dfinity/asset-canister@v2.1.0"
      configuration:
        dir: dist
        build:
          - npm install
          - npm run build
```

For multi-canister projects, list all canisters in the same `canisters` array. icp-cli builds them in parallel. There is no `dependencies` field — use Canister Environment Variables for inter-canister communication.

### Custom build steps (no recipe)

```yaml
canisters:
  - name: backend
    build:
      steps:
        - type: script
          commands:
            - cargo build --target wasm32-unknown-unknown --release
            - cp target/wasm32-unknown-unknown/release/backend.wasm "$ICP_WASM_OUTPUT_PATH"
```

`ICP_WASM_OUTPUT_PATH` is an environment variable that tells your build script where to place the final WASM file.

### Available recipes

| Recipe | Purpose |
|--------|---------|
| `@dfinity/rust` | Rust canisters with Cargo |
| `@dfinity/motoko` | Motoko canisters |
| `@dfinity/asset-canister` | Asset canisters for static files |
| `@dfinity/prebuilt` | Pre-compiled WASM files |

Use `icp project show` to see the effective configuration after recipe expansion.

## dfx → icp Migration

### Command mapping

| Task | dfx | icp |
|------|-----|-----|
| Create project | `dfx new my_project` | `icp new my_project` |
| Start local network | `dfx start --background` | `icp network start -d` |
| Stop local network | `dfx stop` | `icp network stop` |
| Build | `dfx build` | `icp build` |
| Deploy all | `dfx deploy` | `icp deploy` |
| Deploy to mainnet | `dfx deploy --network ic` | `icp deploy -e ic` |
| Call canister | `dfx canister call X method '(args)'` | `icp canister call X method '(args)'` |
| Get canister ID | `dfx canister id X` | `icp canister status X --id-only` |
| Canister status | `dfx canister status X` | `icp canister status X` |
| List canisters | `dfx canister ls` | `icp canister list` |
| Create identity | `dfx identity new my_id` | `icp identity new my_id` |
| Set default identity | `dfx identity use my_id` | `icp identity default my_id` |
| Show principal | `dfx identity get-principal` | `icp identity principal` |
| Export identity | `dfx identity export my_id` | `icp identity export my_id` |
| Delete identity | `dfx identity remove my_id` | `icp identity delete my_id` |
| Get account ID | `dfx ledger account-id` | `icp identity account-id` |
| Check ICP balance | `dfx ledger balance` | `icp token balance` |
| Check cycles | `dfx wallet balance` | `icp cycles balance` |

### Configuration mapping

| dfx.json | icp.yaml |
|----------|----------|
| `"type": "rust"` | `recipe.type: "@dfinity/rust@v3.2.0"` |
| `"type": "motoko"` | `recipe.type: "@dfinity/motoko@v4.1.0"` |
| `"type": "assets"` | `recipe.type: "@dfinity/asset-canister@v2.1.0"` |
| `"package": "X"` | `recipe.configuration.package: X` |
| `"candid": "X"` | `recipe.configuration.candid: X` |
| `"main": "X"` | `recipe.configuration.main: X` |
| `"source": ["dist"]` | `recipe.configuration.dir: dist` |
| `"dependencies": [...]` | Not needed — use Canister Environment Variables |
| `--network ic` | `-e ic` |

### Identity migration

```bash
# Export from dfx, import to icp-cli
dfx identity export my-identity > /tmp/my-identity.pem
icp identity import my-identity --from-pem /tmp/my-identity.pem
rm /tmp/my-identity.pem

# Verify principals match
dfx identity get-principal --identity my-identity
icp identity principal --identity my-identity
```

### Canister ID migration

If you have existing mainnet canisters managed by dfx, create the mapping file:

```bash
# Get IDs from dfx
dfx canister id frontend --network ic
dfx canister id backend --network ic

# Create mapping file for icp-cli
mkdir -p .icp/data/mappings
cat > .icp/data/mappings/ic.ids.json << 'EOF'
{
  "frontend": "xxxxx-xxxxx-xxxxx-xxxxx-cai",
  "backend": "yyyyy-yyyyy-yyyyy-yyyyy-cai"
}
EOF

# Commit to version control
git add .icp/data/
```

## Verify It Works

```bash
# 1. Create and deploy a project locally
icp new my-test --subfolder hello-world \
  --define backend_type=motoko \
  --define frontend_type=react \
  --define network_type=Default && cd my-test
icp network start -d
icp deploy
# Expected: Canisters deployed successfully

# 2. Call the backend
icp canister call backend greet '("World")'
# Expected: ("Hello, World!")

# 3. Check effective configuration (recipe expansion)
icp project show
# Expected: Expanded recipe configuration

# 4. Stop local network
icp network stop
```
