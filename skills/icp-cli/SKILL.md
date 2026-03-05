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

10. **Expecting `output_env_file` or `.env` with canister IDs.** dfx writes canister IDs to a `.env` file (`CANISTER_ID_BACKEND=...`) via `output_env_file`. icp-cli does not generate `.env` files. Instead, it injects canister IDs as environment variables (`PUBLIC_CANISTER_ID:<name>`) directly into canisters during `icp deploy`. Frontends read these from the `ic_env` cookie set by the asset canister. Remove `output_env_file` from your config and any code that reads `CANISTER_ID_*` from `.env` — use the `ic_env` cookie instead (see Canister Environment Variables below).

11. **Expecting `dfx generate` for TypeScript bindings.** icp-cli does not have a `dfx generate` equivalent. Use `@icp-sdk/bindgen` (a Vite plugin) to generate TypeScript bindings from `.did` files at build time. The `.did` file must exist on disk — either commit it to the repo, or generate it with `icp build` first (recipes auto-generate it when `candid` is not specified). See Binding Generation below.

12. **Misunderstanding Candid file generation with recipes.** When using the Rust or Motoko recipe:
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

### Binding Generation

icp-cli does not have a built-in `dfx generate` command. Use `@icp-sdk/bindgen` to generate TypeScript bindings from `.did` files.

**Vite plugin** (recommended for Vite-based frontend projects):
```js
// vite.config.js
import { icpBindgen } from "@icp-sdk/bindgen/plugins/vite";

export default defineConfig({
  plugins: [
    // Add one icpBindgen() call per canister the frontend needs to access
    icpBindgen({
      didFile: "../backend/backend.did",
      outDir: "./src/bindings/backend",
    }),
    icpBindgen({
      didFile: "../other/other.did",
      outDir: "./src/bindings/other",
    }),
  ],
});
```

Each `icpBindgen()` instance generates a `createActor` function in its `outDir`. Add `**/src/bindings/` to `.gitignore`.

**Creating actors from bindings** — connect the generated bindings with the `ic_env` cookie:
```js
// src/actor.js
import { safeGetCanisterEnv } from "@icp-sdk/core/agent/canister-env";
import { createActor } from "./bindings/backend";
// For additional canisters: import { createActor as createOther } from "./bindings/other";

const canisterEnv = safeGetCanisterEnv();
const agentOptions = {
  host: window.location.origin,
  rootKey: canisterEnv?.IC_ROOT_KEY,
};

export const backend = createActor(
  canisterEnv?.["PUBLIC_CANISTER_ID:backend"],
  { agentOptions }
);
// Repeat for each canister: createOther(canisterEnv?.["PUBLIC_CANISTER_ID:other"], { agentOptions })
```

**Non-Vite frontends** — use the `@icp-sdk/bindgen` CLI to generate bindings manually:
```bash
npx @icp-sdk/bindgen --did ../backend/backend.did --out ./src/bindings/backend
```

**Requirements:**
- The `.did` file must exist on disk. If using a recipe with `candid` specified, the file must be committed. If `candid` is omitted, run `icp build` first to auto-generate it.
- `@icp-sdk/bindgen` generates code that depends on `@icp-sdk/core`. Projects using `@dfinity/agent` must upgrade to `@icp-sdk/core` + `@icp-sdk/bindgen`. This is not optional — there is no way to generate TypeScript bindings with icp-cli while staying on `@dfinity/agent`.

### Dev Server Configuration (Vite)

In development, the Vite dev server must simulate the `ic_env` cookie that the asset canister provides in production. Query the local network for the root key, canister IDs, and API URL:

```js
// vite.config.js
import { execSync } from "child_process";

const environment = process.env.ICP_ENVIRONMENT || "local";
// List all backend canisters the frontend needs to access
const CANISTER_NAMES = ["backend", "other"];

function getCanisterId(name) {
  return execSync(`icp canister status ${name} -e ${environment} -i`, {
    encoding: "utf-8", stdio: "pipe",
  }).trim();
}

function getDevServerConfig() {
  const networkStatus = JSON.parse(
    execSync(`icp network status -e ${environment} --json`, {
      encoding: "utf-8",
    })
  );
  const canisterParams = CANISTER_NAMES
    .map((name) => `PUBLIC_CANISTER_ID:${name}=${getCanisterId(name)}`)
    .join("&");
  return {
    headers: {
      "Set-Cookie": `ic_env=${encodeURIComponent(
        `${canisterParams}&ic_root_key=${networkStatus.root_key}`
      )}; SameSite=Lax;`,
    },
    proxy: {
      "/api": { target: networkStatus.api_url, changeOrigin: true },
    },
  };
}
```

Key differences from dfx:
- The proxy target and root key come from `icp network status --json` (no hardcoded ports)
- Canister IDs come from `icp canister status <name> -e <env> -i` (no `.env` file)
- The `ic_env` cookie replaces dfx's `CANISTER_ID_*` environment variables
- `ICP_ENVIRONMENT` lets the dev server target any environment (local, staging, ic)

## dfx → icp Migration

### Local network port change

dfx serves the local network on port `4943`. icp-cli uses port `8000`. When migrating, search the project for hardcoded references to `4943` (or `localhost:4943`) and update them to `8000`. Better yet, use `icp network status --json` to get the `api_url` dynamically (see Dev Server Configuration above). Common locations to check:
- Vite/webpack proxy configs (e.g., `vite.config.ts`)
- README documentation
- Test fixtures and scripts

### Remove `.env` file and `output_env_file`

dfx generates a `.env` file with `CANISTER_ID_*` variables via `output_env_file` in `dfx.json`. icp-cli does not use `.env` files for canister IDs — remove `output_env_file` from config and delete any dfx-generated `.env` file. Also remove dfx-specific environment variables from `.env` files (e.g., `DFX_NETWORK`, `NETWORK`).

Replace code that reads `process.env.CANISTER_ID_*` with the `ic_env` cookie pattern (see Canister Environment Variables above).

### Frontend package migration

Since `@icp-sdk/bindgen` generates code that depends on `@icp-sdk/core`, projects with TypeScript bindings **must** upgrade from `@dfinity/*` packages. This is not optional — `dfx generate` does not exist in icp-cli, and `@icp-sdk/bindgen` is the only supported way to generate bindings.

| Remove | Replace with |
|--------|-------------|
| `@dfinity/agent` | `@icp-sdk/core` |
| `@dfinity/candid` | `@icp-sdk/core` |
| `@dfinity/principal` | `@icp-sdk/core` |
| `dfx generate` (declarations) | `@icp-sdk/bindgen` (Vite plugin or CLI) |
| `vite-plugin-environment` | Not needed — use `ic_env` cookie |
| `src/declarations/` (generated by dfx) | `src/bindings/` (generated by `@icp-sdk/bindgen`) |

Steps:
1. `npm uninstall @dfinity/agent @dfinity/candid @dfinity/principal vite-plugin-environment`
2. `npm install @icp-sdk/core @icp-sdk/bindgen`
3. Delete `src/declarations/` (dfx-generated bindings)
4. Add `**/src/bindings/` to `.gitignore`
5. Commit the `.did` file(s) used by bindgen
6. Add `icpBindgen()` to `vite.config.js` (see Binding Generation above)
7. Replace actor setup code: use `safeGetCanisterEnv` from `@icp-sdk/core` + `createActor` from generated bindings (see Creating actors from bindings above)
8. Remove `process.env.CANISTER_ID_*` references — use the `ic_env` cookie instead

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
| `"output_env_file": ".env"` | Not needed — use `ic_env` cookie |
| `dfx generate` | `@icp-sdk/bindgen` Vite plugin |
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

## Post-Migration Verification

After migrating a project from dfx to icp-cli, verify the following:

1. **Deleted files**: `dfx.json` and `canister_ids.json` no longer exist
2. **Created files**: `icp.yaml` exists. `.icp/data/mappings/ic.ids.json` exists and is committed (if project has mainnet canisters)
3. **`.gitignore`**: contains `.icp/cache/`, does not contain `.dfx`
4. **No stale port references**: search the codebase for `4943` — there should be zero matches
5. **No dfx env patterns**: search for `output_env_file`, `CANISTER_ID_`, `DFX_NETWORK` — there should be zero matches in config and source files
6. **Frontend packages** (if project has TypeScript bindings): `@dfinity/agent` is not in `package.json`, `@icp-sdk/core` and `@icp-sdk/bindgen` are. `src/declarations/` is deleted, `src/bindings/` is in `.gitignore`
7. **Candid files**: `.did` files used by `@icp-sdk/bindgen` are committed
8. **Build succeeds**: `icp build` completes without errors
9. **Config is correct**: `icp project show` displays the expected expanded configuration
10. **README**: references `icp` commands (not `dfx`), says "local network" (not "replica"), shows correct port
