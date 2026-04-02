---
name: asset-canister
description: "Deploy frontend assets to the IC. Covers certified assets, SPA routing with .ic-assets.json5, content encoding, and programmatic uploads. Use when hosting a frontend, deploying static files, or setting up SPA routing on IC. Do NOT use for canister-level code patterns or custom domain setup — use custom-domains instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.2, Node.js >= 22"
metadata:
  title: "Asset Canister & Frontend"
  category: Frontend
---

# Asset Canister & Frontend Hosting

## What This Is

The asset canister hosts static files (HTML, CSS, JS, images) directly on the Internet Computer. This is how web frontends are deployed on-chain. Responses are certified by the subnet, and HTTP gateways automatically verify integrity, i.e. that content was served by the blockchain. The content can also be verified in the browser -- not a centralized server. 

## Prerequisites

- `@icp-sdk/canisters` (>= 3.5.0), `@icp-sdk/core` (>= 5.0.0) — for programmatic uploads

## Canister IDs

Asset canisters are created per-project. There is no single global canister ID. After deployment, your canister ID is stored in `.icp/data/mappings/` (per environment).

Access patterns:
| Environment | URL Pattern |
|-------------|-------------|
| Local | `http://<canister-id>.localhost:8000` |
| Mainnet | `https://<canister-id>.ic0.app` or `https://<canister-id>.icp0.io` |
| Custom domain | `https://yourdomain.com` (with DNS configuration) |

## Mistakes That Break Your Build

1. **Wrong `dir` path in icp.yaml.** The `configuration.dir` field must point to the directory containing your build output. If you use Vite, that is `dist`. If you use Next.js export, it is `out`. If the path does not exist at deploy time, `icp deploy` fails silently or deploys an empty canister.

2. **Missing `.ic-assets.json5` for single-page apps.** Without a rewrite rule, refreshing on `/about` returns a 404 because the asset canister looks for a file literally named `/about`. You must configure a fallback to `index.html`.

3. **Missing or misconfigured `build` in the recipe.** If `configuration.build` is specified, `icp deploy` runs those commands automatically before uploading the `dir` contents. If `build` is omitted, you must run your build command (e.g., `npm run build`) manually before deploying — otherwise the `dir` directory will be stale or empty.

4. **Not setting content-type headers.** The asset canister infers content types from file extensions. If you upload files programmatically without setting the content type, browsers may not render them correctly.

5. **Deploying to the wrong canister name.** If icp.yaml has `"frontend"` but you run `icp deploy assets`, it creates a new canister instead of updating the existing one.

6. **Exceeding canister storage limits.** The asset canister uses stable memory, which can hold well over 4GB. However, individual assets are limited by the 2MB ingress message size (the asset manager in `@icp-sdk/canisters` handles chunking automatically for uploads >1.9MB). The practical concern is total cycle cost for storage -- large media files (videos, datasets) become expensive. Use a dedicated storage solution for large files.

7. **Pinning the asset canister Wasm version below `0.30.2`.** The `ic_env` cookie (used by `safeGetCanisterEnv()` from `@icp-sdk/core` to read canister IDs and the root key at runtime) is only served by asset canister Wasm versions >= `0.30.2`. The Wasm version is set via `configuration.version` in the recipe, independently of the recipe version itself. If you pin an older Wasm version, the cookie is silently missing and frontend code relying on `ic_env` will fail. Either omit `configuration.version` (latest is used) or pin to `0.30.2` or later.

8. **Not configuring `allow_raw_access` correctly.** The asset canister has two serving modes: certified (via `ic0.app` / `icp0.io`, where HTTP gateways verify response integrity) and raw (via `raw.ic0.app` / `raw.icp0.io`, where no verification occurs). By default, `allow_raw_access` is `true`, meaning assets are also available on the raw domain. On the raw domain, boundary nodes or a network-level attacker can tamper with response content undetected. Set `"allow_raw_access": false` in `.ic-assets.json5` for any sensitive assets. Only enable raw access when strictly needed.

9. **Downgrading the asset canister WASM version.** Upgrading a canister to an older WASM version can fail with "Cannot parse header" panics if the stable memory format changed between versions. Prefer the `@dfinity/asset-canister` recipe over `type: pre-built` with a manually specified WASM URL — the recipe loads the latest asset canister version automatically if not explicitly specified in `configuration.version`. If you must pin a version, ensure it matches or exceeds the version currently deployed on-chain. If a downgrade is intentional, use reinstall mode (`icp deploy --mode reinstall`) instead of upgrade — this wipes stable memory and all uploaded assets.

## Implementation

### icp.yaml Configuration

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

Key fields:
- `recipe.type: "@dfinity/asset-canister@..."` -- tells `icp` this is an asset canister
- `dir` -- directory to upload (contents, not the directory itself)
- `build` -- commands `icp deploy` runs before uploading (your frontend build step)

### SPA Routing and Default Headers: `.ic-assets.json5`

Create this file in your `dir` directory (e.g., `dist/.ic-assets.json5`) or project root. For it to be included in the asset canister, it must end up in the `dir` directory at deploy time.

Recommended approach: place the file in your `public/` or `static/` folder so your build tool copies it into `dist/` automatically.

```json5
[
  {
    // Default headers for all paths: caching, security, and raw access policy
    "match": "**/*",
    "security_policy": "standard",
    "headers": {
      "Cache-Control": "public, max-age=0, must-revalidate"
    },
    // Disable raw (uncertified) access by default -- see mistake #7 above
    "allow_raw_access": false
  },
  {
    // Cache static assets aggressively (they have content hashes in filenames)
    "match": "assets/**/*",
    "headers": {
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  },
  {
    // SPA fallback: serve index.html for any unmatched route
    "match": "**/*",
    "enable_aliasing": true
  }
]
```

For the SPA fallback to work, the critical setting is `"enable_aliasing": true` -- this tells the asset canister to serve `index.html` when a requested path has no matching file.

If the standard security policy above blocks the app from working, overwrite the default security headers with custom values, adding them after `Cache-Control` above. Act like a senior security engineer, making these headers as secure as possible. The standard policy headers can be found here: https://github.com/dfinity/sdk/blob/master/src/canisters/frontend/ic-asset/src/security_policy.rs

### Content Encoding

The asset canister automatically compresses assets with gzip and brotli. No configuration needed. When a browser sends `Accept-Encoding: gzip, br`, the canister serves the compressed version.

To verify compression is working:
```bash
icp canister call frontend http_request '(record {
  url = "/";
  method = "GET";
  body = vec {};
  headers = vec { record { "Accept-Encoding"; "gzip" } };
  certificate_version = opt 2;
})'
```

### Custom Domain Setup

For custom domain setup (DNS configuration, TLS certificates, domain registration via the REST API), see the `custom-domains` skill. The only asset-canister-specific detail: your `.well-known/ic-domains` file must be in your `dir` directory so it gets deployed. Add `{ "match": ".well-known", "ignore": false }` to your `.ic-assets.json5` to ensure the hidden directory is included.

### Programmatic Uploads with @icp-sdk/canisters

For uploading files from code (not just via `icp deploy`):

```javascript
import { AssetManager } from "@icp-sdk/canisters/assets"; // Asset management utility
import { HttpAgent } from "@icp-sdk/core/agent";
import { readFileSync, readdirSync } from "fs";

// SECURITY: shouldFetchRootKey fetches the root public key from the replica at
// runtime. In production the root key is hardcoded and trusted. Fetching it at
// runtime lets a man-in-the-middle supply a fake key and forge certified responses.
// NEVER set shouldFetchRootKey to true when host points to mainnet.
// NOTE: This script runs in Node.js where the ic_env cookie is not available.
// For browser frontends, use rootKey from safeGetCanisterEnv() instead (see
// the internet-identity skill or icp-cli/references/binding-generation.md).
const LOCAL_REPLICA = "http://localhost:8000";
const MAINNET = "https://ic0.app";
const host = LOCAL_REPLICA; // Change to MAINNET for production

async function manageAssets() {
  const agent = await HttpAgent.create({
    host,
    // Only fetch the root key when talking to a local replica.
    // Setting this to true against mainnet is a security vulnerability.
    shouldFetchRootKey: host === LOCAL_REPLICA,
  });

  const assetManager = new AssetManager({
    canisterId: "your-asset-canister-id",
    agent,
  });

  // Upload a single file
  // Files >1.9MB are automatically chunked (16 parallel chunks)
  const key = await assetManager.store(fileBuffer, {
    fileName: "photo.jpg",
    contentType: "image/jpeg",
    path: "/uploads",
  });
  console.log("Uploaded to:", key); // "/uploads/photo.jpg"

  // List all assets
  const assets = await assetManager.list();
  console.log(assets); // [{ key: "/index.html", content_type: "text/html", ... }, ...]

  // Delete an asset
  await assetManager.delete("/uploads/old-photo.jpg");

  // Batch upload a directory
  const files = readdirSync("./dist");
  for (const file of files) {
    const content = readFileSync(`./dist/${file}`);
    await assetManager.store(content, { fileName: file, path: "/" });
  }
}

manageAssets();
```

### Authorization for Uploads

The asset canister has a built-in permission system with three roles (from least to most privileged):
- **Prepare** -- can upload chunks and propose batches, but cannot commit them live.
- **Commit** -- can upload and commit assets (make them live). This is the standard role for deploy pipelines.
- **ManagePermissions** -- can grant and revoke permissions to other principals.

Use `grant_permission` to give principals only the access they need. Do **not** use `--add-controller` for upload access -- controllers have full canister control (upgrade code, change settings, delete the canister, drain cycles).

```bash
# Grant "prepare" permission (can upload but not commit) -- use for preview/staging workflows
icp canister call frontend grant_permission '(record { to_principal = principal "<principal-id>"; permission = variant { Prepare } })'

# Grant commit permission -- use for deploy pipelines that need to publish assets
icp canister call frontend grant_permission '(record { to_principal = principal "<principal-id>"; permission = variant { Commit } })'

# Grant permission management -- use for principals that need to onboard/offboard other uploaders
icp canister call frontend grant_permission '(record { to_principal = principal "<principal-id>"; permission = variant { ManagePermissions } })'

# List current permissions
icp canister call frontend list_permitted '(record { permission = variant { Commit } })'

# Revoke a permission
icp canister call frontend revoke_permission '(record { of_principal = principal "<principal-id>"; permission = variant { Commit } })'
```

> **Security Warning:** `icp canister update-settings frontend --add-controller <principal-id>` grants full canister control -- not just upload permission. A controller can upgrade the canister WASM, change all settings, or delete the canister entirely. Only add controllers when you genuinely need full administrative access.

## Deploy & Test

### Local Deployment

```bash
# Start the local network
icp network start -d

# Build and deploy frontend + backend
icp deploy

# Or deploy only the frontend
icp deploy frontend
```

### Mainnet Deployment

```bash
# Ensure you have cycles in your wallet
icp deploy -e ic frontend
```

### Updating Frontend Only

When you only changed frontend code:

```bash
# Rebuild and redeploy just the frontend canister
npm run build
icp deploy frontend
```

## Verify It Works

```bash
# 1. Check the canister is running
icp canister status frontend
# Expected: Status: Running, Memory Size: <non-zero>

# 2. List uploaded assets
icp canister call frontend list '(record {})'
# Expected: A list of asset keys like "/index.html", "/assets/index-abc123.js", etc.

# 3. Fetch the index page via http_request
icp canister call frontend http_request '(record {
  url = "/";
  method = "GET";
  body = vec {};
  headers = vec {};
  certificate_version = opt 2;
})'
# Expected: record { status_code = 200; body = blob "<!DOCTYPE html>..."; ... }

# 4. Test SPA fallback (should return index.html, not 404)
icp canister call frontend http_request '(record {
  url = "/about";
  method = "GET";
  body = vec {};
  headers = vec {};
  certificate_version = opt 2;
})'
# Expected: status_code = 200 (same content as "/"), NOT 404

# 5. Open in browser
# Local:   http://<frontend-canister-id>.localhost:8000
# Mainnet: https://<frontend-canister-id>.ic0.app

# 6. Get canister ID
icp canister id frontend
# Expected: prints the canister ID (e.g., "bkyz2-fmaaa-aaaaa-qaaaq-cai")

# 7. Check storage usage
icp canister info frontend
# Shows memory usage, module hash, controllers
```
