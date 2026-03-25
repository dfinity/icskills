# Binding Generation

icp-cli does not have a built-in `dfx generate` command. Use `@icp-sdk/bindgen` (>= 0.3.0) to generate TypeScript bindings from `.did` files. It depends on `@icp-sdk/core` (>= 5.0.0).

## Vite plugin (recommended)

For Vite-based frontend projects:
```js
// vite.config.js
import { icpBindgen } from "@icp-sdk/bindgen/plugins/vite";

export default defineConfig({
  plugins: [
    // Add one icpBindgen() call per canister the frontend needs to access
    icpBindgen({
      didFile: "../backend/backend.did",
      outDir: "./src/bindings",
    }),
    icpBindgen({
      didFile: "../other/other.did",
      outDir: "./src/bindings",
    }),
  ],
});
```

Each `icpBindgen()` instance generates a `<canister-name>.ts` file (named after the `.did` file) in its `outDir` containing a `createActor` function. Add `**/src/bindings/` to `.gitignore`.

## Creating actors from bindings

Connect the generated bindings with the `ic_env` cookie:
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

## Non-Vite frontends

Use the `@icp-sdk/bindgen` CLI to generate bindings manually:
```bash
npx @icp-sdk/bindgen --did ../backend/backend.did --out ./src/bindings
```

## Requirements

Install both packages in the frontend project (note the minimum versions):
```bash
npm install @icp-sdk/core@^5.0.0
npm install -D @icp-sdk/bindgen@^0.3.0
```

**Important:** `@icp-sdk/core` starts at version 5.x — there is no 0.x or 1.x release. Do not guess a lower version.

- The `.did` file must exist on disk before the frontend builds. The recommended workflow: generate the `.did` file once (see SKILL.md pitfall #12), commit it to the repo, and specify `candid:` in the recipe config. If `candid` is omitted, the recipe auto-generates the `.did` into the build cache at a non-deterministic path that bindgen cannot reference — so always commit the `.did` and set `candid:` when using bindgen.
- `@icp-sdk/bindgen` (>= 0.3.0) generates code that depends on `@icp-sdk/core` (>= 5.0.0). Projects using `@dfinity/agent` must upgrade to `@icp-sdk/core` + `@icp-sdk/bindgen`. This is not optional — there is no way to generate TypeScript bindings with icp-cli while staying on `@dfinity/agent`.
