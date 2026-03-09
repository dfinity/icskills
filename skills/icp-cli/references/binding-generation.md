# Binding Generation

icp-cli does not have a built-in `dfx generate` command. Use `@icp-sdk/bindgen` to generate TypeScript bindings from `.did` files.

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
npx @icp-sdk/bindgen --did ../backend/backend.did --out ./src/bindings/backend
```

## Requirements

- The `.did` file must exist on disk. If using a recipe with `candid` specified, the file must be committed. If `candid` is omitted, run `icp build` first to auto-generate it.
- `@icp-sdk/bindgen` generates code that depends on `@icp-sdk/core`. Projects using `@dfinity/agent` must upgrade to `@icp-sdk/core` + `@icp-sdk/bindgen`. This is not optional — there is no way to generate TypeScript bindings with icp-cli while staying on `@dfinity/agent`.
