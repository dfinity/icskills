# Dev Server Configuration (Vite)

In development, the Vite dev server must simulate the `ic_env` cookie that the asset canister provides in production. Query the local network for the root key, canister IDs, and API URL:

```js
// vite.config.js
import { execSync } from "child_process";

const environment = process.env.ICP_ENVIRONMENT || "local";
// List all backend canisters the frontend needs to access
const CANISTER_NAMES = ["backend", "other"];

function getCanisterId(name) {
  // `-i` makes the command return only the identity of the canister
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

## Key differences from dfx

- The proxy target and root key come from `icp network status --json` (no hardcoded ports)
- Canister IDs come from `icp canister status <name> -e <env> -i` (no `.env` file)
- The `ic_env` cookie replaces dfx's `CANISTER_ID_*` environment variables
- `ICP_ENVIRONMENT` lets the dev server target any environment (local, staging, ic)
