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

## Installation

**Recommended (npm)** — requires [Node.js](https://nodejs.org/) >= 22:
```bash
npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm
```

`ic-wasm` is required when using official recipes (`@dfinity/rust`, `@dfinity/motoko`, `@dfinity/asset-canister`) — they depend on it for optimization and metadata embedding.

**Alternative methods:**
```bash
# Homebrew (macOS/Linux)
brew install icp-cli
brew install ic-wasm

# Shell script (macOS/Linux/WSL)
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/dfinity/icp-cli/releases/latest/download/icp-cli-installer.sh | sh
curl --proto '=https' --tlsv1.2 -LsSf https://github.com/dfinity/ic-wasm/releases/latest/download/ic-wasm-installer.sh | sh
```

**Verify:**
```bash
icp --version
ic-wasm --version
```

**Linux note:** On minimal installs, you may need system libraries: `sudo apt-get install -y libdbus-1-3 libssl3 ca-certificates` (Ubuntu/Debian) or `sudo dnf install -y dbus-libs openssl ca-certificates` (Fedora/RHEL).

## Prerequisites

- For Rust canisters: `rustup target add wasm32-unknown-unknown`
- For Motoko canisters: `npm i -g ic-mops` and a `mops.toml` at the project root with the Motoko compiler version:
  ```toml
  [toolchain]
  moc = "1.3.0"
  ```
  The `@dfinity/motoko` recipe uses this to resolve the compiler. Without `mops.toml`, the recipe fails because `moc` is not found. Templates include `mops.toml` automatically; for manual projects, create it before running `icp build`.

## Common Pitfalls

1. **Using `dfx` instead of `icp`.** The `dfx` tool is legacy. All commands have `icp` equivalents — see `references/dfx-migration.md` for the full command mapping. Never generate `dfx` commands or reference `dfx` documentation. Configuration uses `icp.yaml`, not `dfx.json` — and the structure differs: canisters are an array of objects, not a keyed object.

2. **Using `--network ic` to deploy to mainnet.** icp-cli uses environments, not direct network targeting. The correct flag is `-e ic` (short for `--environment ic`).
   ```bash
   # Wrong
   icp deploy --network ic
   # Correct
   icp deploy -e ic
   ```
   Note: `-n` / `--network` targets a network directly and works with canister IDs (principals). Use `-e` / `--environment` when referencing canisters by name. For token and cycles operations, use `-n` since they don't reference project canisters.

3. **Using a recipe without a version pin.** icp-cli rejects unpinned recipe references. Always include an explicit version. Official recipes are hosted at [dfinity/icp-cli-recipes](https://github.com/dfinity/icp-cli-recipes).
   ```yaml
   # Wrong — rejected by icp-cli
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

8. **Writing `networks` or `environments` as a YAML map instead of an array.** Both `networks` and `environments` are arrays of objects in `icp.yaml`, not maps:
   ```yaml
   # Wrong — map syntax
   networks:
     local:
       mode: managed
   environments:
     staging:
       network: ic

   # Correct — array syntax
   networks:
     - name: local
       mode: managed
   environments:
     - name: staging
       network: ic
       canisters: [backend, frontend]
   ```

9. **Forgetting that local networks are project-local.** Unlike dfx which runs one shared global network, icp-cli runs a local network per project. You must run `icp network start -d` in your project directory before deploying locally. The local network auto-starts with system canisters and seeds accounts with ICP and cycles.

10. **Not specifying build commands for asset canisters.** dfx automatically runs `npm run build` for asset canisters. icp-cli requires explicit build commands in the recipe configuration:
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

11. **Expecting `output_env_file` or `.env` with canister IDs.** dfx writes canister IDs to a `.env` file (`CANISTER_ID_BACKEND=...`) via `output_env_file`. icp-cli does not generate `.env` files. Instead, it injects canister IDs as environment variables (`PUBLIC_CANISTER_ID:<name>`) directly into canisters during `icp deploy`. Frontends read these from the `ic_env` cookie set by the asset canister. Remove `output_env_file` from your config and any code that reads `CANISTER_ID_*` from `.env` — use the `ic_env` cookie instead (see Canister Environment Variables below).

12. **Expecting `dfx generate` for TypeScript bindings.** icp-cli does not have a `dfx generate` equivalent. Use `@icp-sdk/bindgen` (>= 0.3.0) with `@icp-sdk/core` (>= 5.0.0 — there is no 0.x or 1.x release) to generate TypeScript bindings from `.did` files at build time. Use `outDir: "./src/bindings"` so imports are clean (e.g., `./bindings/backend`). The `.did` file must exist on disk — either commit it to the repo, or generate it with `icp build` first (recipes auto-generate it when `candid` is not specified). See `references/binding-generation.md` for the full Vite plugin setup.

13. **Passing `{ agent }` to `createActor` from `@icp-sdk/bindgen`.** The old `@dfinity/agent` pattern was `createActor(canisterId, { agent })`. The `@icp-sdk/bindgen` pattern is `createActor(canisterId, { agentOptions: { host, rootKey } })` — the binding creates the agent internally. Passing `{ agent }` to the new API **silently creates an anonymous identity** — no error is thrown, but calls return empty data or access denied. See `references/binding-generation.md` for the correct pattern.

14. **Mixing canister-level fields across config styles.** When using a recipe, the only valid canister-level fields are `name`, `recipe`, `sync`, `settings`, and `init_args`. Fields like `candid`, `build`, or `wasm` are **not** valid at canister level alongside a recipe — recipe-specific options go inside `recipe.configuration`. When using bare `build` (no recipe), valid canister-level fields are `name`, `build`, `sync`, `settings`, and `init_args`. The field `init_arg_file` does not exist — use `init_args.path` instead (e.g., `init_args: { path: ./args.bin, format: bin }`). For the authoritative field reference, consult the [icp-cli configuration reference](https://cli.internetcomputer.org/0.2/reference/configuration.md).
    ```yaml
    # Wrong — candid is not a canister-level field when using a recipe
    canisters:
      - name: backend
        candid: backend/backend.did
        recipe:
          type: "@dfinity/rust@v3.2.0"
          configuration:
            package: backend

    # Correct — candid goes inside recipe.configuration
    canisters:
      - name: backend
        recipe:
          type: "@dfinity/rust@v3.2.0"
          configuration:
            package: backend
            candid: backend/backend.did
    ```

15. **Placing `mops.toml` where `mops` cannot find it.** `mops` searches upward from the build working directory. Where to place `mops.toml` depends on how the canister is defined:
    - **Inline canisters** (defined directly in `icp.yaml`): build cwd is the project root. Place `mops.toml` at the project root next to `icp.yaml`. A `mops.toml` in `src/backend/` will not be found.
    - **Path-based canisters** (referenced via `canisters/*` or `./my-canister`, each with its own `canister.yaml`): build cwd is the canister directory. Place `mops.toml` in each canister's directory for per-canister dependencies and compiler versions, or omit it to fall back to a shared `mops.toml` in a parent directory.

    When `mops.toml` is not found, `mops toolchain bin moc` outputs an error instead of a path, causing a cryptic `sh: Error:: command not found` build failure.

16. **Misunderstanding Candid file generation with recipes.** When using the Rust or Motoko recipe:
    - If `candid` is **specified**: the file must already exist (checked in or manually created). The recipe uses it as-is and does **not** generate one.
    - If `candid` is **omitted**: the recipe auto-generates the `.did` file from the compiled WASM (via `candid-extractor` for Rust, `moc` for Motoko). The generated file is placed in the build cache, not at a predictable project path.

    For projects that need a `.did` file on disk (e.g., for `@icp-sdk/bindgen`), the recommended pattern is: generate the `.did` file once, commit it, and specify `candid` in the recipe config. To generate it manually:

    **Rust** — build the WASM first, then extract the Candid interface:
    ```bash
    cargo install candid-extractor  # one-time setup
    icp build backend
    candid-extractor target/wasm32-unknown-unknown/release/backend.wasm > backend/backend.did
    ```

    **Motoko** — use `moc` directly with the `--idl` flag:
    ```bash
    $(mops toolchain bin moc) --idl $(mops sources) -o backend/backend.did backend/app.mo
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

When not using a recipe, only `name`, `build`, `sync`, `settings`, and `init_args` are valid canister-level fields. There are no `wasm`, `candid`, or `metadata` fields — handle these in the build script instead:

- **WASM output**: copy the final WASM to `$ICP_WASM_OUTPUT_PATH`
- **Candid metadata**: use `ic-wasm` to embed `candid:service` metadata
- **Candid file**: the `.did` file is referenced only in the `ic-wasm` command, not as a YAML field

```yaml
canisters:
  - name: backend
    build:
      steps:
        - type: script
          commands:
            - cargo build --target wasm32-unknown-unknown --release
            - cp target/wasm32-unknown-unknown/release/backend.wasm "$ICP_WASM_OUTPUT_PATH"
            - ic-wasm "$ICP_WASM_OUTPUT_PATH" -o "$ICP_WASM_OUTPUT_PATH" metadata candid:service -f backend/backend.did -v public --keep-name-section
```

### Available recipes

| Recipe | Type string | Required config | Optional config |
|--------|------------|-----------------|-----------------|
| Rust | `@dfinity/rust@v3.2.0` | `package` | `candid`, `locked`, `shrink`, `compress` |
| Motoko | `@dfinity/motoko@v4.1.0` | `main` | `candid`, `args`, `shrink`, `compress` |
| Asset | `@dfinity/asset-canister@v2.1.0` | `dir` | `build`, `version` |
| Prebuilt | `@dfinity/prebuilt@v1.0.0` | `wasm` | `sha256`, `candid`, `shrink`, `compress` |

Verify latest recipe versions at [dfinity/icp-cli-recipes releases](https://github.com/dfinity/icp-cli-recipes/releases). Use `icp project show` to see the effective configuration after recipe expansion.

### Canister Environment Variables

icp-cli automatically injects all canister IDs as environment variables during `icp deploy`. Variables are formatted as `PUBLIC_CANISTER_ID:<canister-name>` and injected into every canister in the environment.

**Frontend → Backend** (reading canister IDs in JavaScript):

Asset canisters expose injected variables through a cookie named `ic_env`, set on all HTML responses. Use `@icp-sdk/core` to read it:
```js
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";

const canisterEnv = safeGetCanisterEnv();
const backendId = canisterEnv?.["PUBLIC_CANISTER_ID:backend"];
```

**Backend → Backend** (reading canister IDs in canister code):
- Rust: `ic_cdk::api::env_var_value("PUBLIC_CANISTER_ID:other_canister")`
- Motoko (motoko-core v2.1.0+):
  ```motoko
  import Runtime "mo:core/Runtime";
  let otherId = Runtime.envVar("PUBLIC_CANISTER_ID:other_canister");
  ```

Note: variables are only updated for canisters being deployed. When adding a new canister, run `icp deploy` (without specifying a canister name) to update all canisters with the complete ID set.

## Additional References

For the complete CLI and configuration schema, consult the [icp-cli documentation index](https://cli.internetcomputer.org/llms.txt).

For detailed guides on specific topics, consult these reference files when needed:

- **`references/binding-generation.md`** — TypeScript binding generation with `@icp-sdk/bindgen` (Vite plugin, CLI, actor setup)
- **`references/dev-server.md`** — Vite dev server configuration to simulate the `ic_env` cookie locally. Important: wrap `getDevServerConfig()` in a `command === "serve"` guard so it only runs during `vite dev`, not `vite build`.
- **`references/dfx-migration.md`** — Complete dfx → icp migration guide (command mapping, config mapping, identity/canister ID migration, frontend package migration, post-migration verification checklist)
