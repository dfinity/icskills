---
id: asset-canister
name: "Asset Canister & Frontend"
category: Frontend
description: "Deploy frontend assets to the IC. Certified assets, custom domains, SPA routing, and content encoding."
endpoints: 5
version: 3.2.0
status: stable
dependencies: []
---

# Asset Canister & Frontend Hosting
> version: 3.2.0 | requires: [icp-cli >= 0.1.0]

## What This Is

The asset canister hosts static files (HTML, CSS, JS, images) directly on the Internet Computer. Responses are certified by the subnet, meaning browsers can verify that content was served by the blockchain -- not a centralized server. This is how frontends are deployed on-chain.

## Prerequisites

- icp-cli >= 0.1.0 (`brew install dfinity/tap/icp-cli`)
- Node.js >= 18 (for building frontend assets)
- `@icp-sdk/canisters` npm package (for programmatic uploads)

## Canister IDs

Asset canisters are created per-project. There is no single global canister ID. After deployment, your canister ID is stored in `canister_ids.json` (local and mainnet).

Access patterns:
| Environment | URL Pattern |
|-------------|-------------|
| Local | `http://<canister-id>.localhost:4943` |
| Mainnet | `https://<canister-id>.ic0.app` or `https://<canister-id>.icp0.io` |
| Custom domain | `https://yourdomain.com` (with DNS configuration) |

## Mistakes That Break Your Build

1. **Wrong `source` path in icp.yaml.** The `source` array must point to the directory containing your build output. If you use Vite, that is `"dist"`. If you use Next.js export, it is `"out"`. If the path does not exist at deploy time, `icp deploy` fails silently or deploys an empty canister.

2. **Missing `.ic-assets.json5` for single-page apps.** Without a rewrite rule, refreshing on `/about` returns a 404 because the asset canister looks for a file literally named `/about`. You must configure a fallback to `index.html`.

3. **Forgetting to build before deploy.** `icp deploy` runs the `build` command from icp.yaml, but if it is empty or misconfigured, the `source` directory will be stale or empty.

4. **Not setting content-type headers.** The asset canister infers content types from file extensions. If you upload files programmatically without setting the content type, browsers may not render them correctly.

5. **Deploying to the wrong canister name.** If icp.yaml has `"frontend"` but you run `icp deploy assets`, it creates a new canister instead of updating the existing one.

6. **Exceeding canister storage limits.** The asset canister uses stable memory, which can hold well over 4GB. However, individual assets are limited by the 2MB ingress message size (the asset manager in `@icp-sdk/canisters` handles chunking automatically for uploads >1.9MB). The practical concern is total cycle cost for storage -- large media files (videos, datasets) become expensive. Use a dedicated storage solution for large files.

7. **Not configuring `allow_raw_access` for API responses.** By default, the asset canister serves certified responses through the `ic0.app` domain. If you need raw (uncertified) access for specific assets, configure it in `.ic-assets.json5`.

## Implementation

### icp.yaml Configuration

```yaml
canisters:
  frontend:
    type: assets
    source:
      - dist
    build:
      - npm run build
    dependencies:
      - backend
  backend:
    type: motoko
    main: src/backend/main.mo
```

Key fields:
- `type: assets` -- tells `icp` this is an asset canister
- `source` -- array of directories to upload (contents, not the directory itself)
- `build` -- commands `icp deploy` runs before uploading (your frontend build step)
- `dependencies` -- ensures backend is deployed first (so canister IDs are available)

### SPA Routing: `.ic-assets.json5`

Create this file in your `source` directory (e.g., `dist/.ic-assets.json5`) or project root. For it to be included in the asset canister, it must end up in the `source` directory at deploy time.

Recommended approach: place the file in your `public/` or `static/` folder so your build tool copies it into `dist/` automatically.

```json5
[
  {
    // Set default cache headers for all paths
    "match": "**/*",
    "headers": {
      "Cache-Control": "public, max-age=0, must-revalidate"
    }
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

To serve your asset canister from a custom domain:

1. Create a file `.well-known/ic-domains` in your `source` directory containing your domain:
```
yourdomain.com
www.yourdomain.com
```

2. Add DNS records:
```
# CNAME record pointing to boundary nodes
yourdomain.com.  CNAME  icp1.io.

# ACME challenge record for TLS certificate provisioning
_acme-challenge.yourdomain.com.  CNAME  _acme-challenge.<your-canister-id>.icp2.io.

# Canister ID TXT record for verification
_canister-id.yourdomain.com.  TXT  "<your-canister-id>"
```

3. Deploy your canister so the `.well-known/ic-domains` file is available, then register the custom domain with the boundary nodes. Registration is automatic -- the boundary nodes periodically check for the `.well-known/ic-domains` file and the DNS records. No NNS proposal is needed.

4. Wait for the boundary nodes to pick up the registration and provision the TLS certificate. This typically takes a few minutes. You can verify by visiting `https://yourdomain.com` once DNS has propagated.

### Programmatic Uploads with @icp-sdk/canisters

For uploading files from code (not just via `icp deploy`):

```javascript
import { AssetManager } from "@icp-sdk/canisters/assets"; // Asset management utility
import { HttpAgent } from "@icp-sdk/core/agent";

// Create an agent with an authorized identity
const agent = await HttpAgent.create({
  host: "http://localhost:4943",
  shouldFetchRootKey: true, // Local only
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
import { readFileSync, readdirSync } from "fs";
const files = readdirSync("./dist");
for (const file of files) {
  const content = readFileSync(`./dist/${file}`);
  await assetManager.store(content, { fileName: file, path: "/" });
}
```

### Authorization for Uploads

Only canister controllers can upload to asset canisters. To grant upload permission:

```bash
# Add a principal as a controller
icp canister update-settings frontend --add-controller <principal-id>

# Or grant "prepare" permission (can upload but not commit) -- more restrictive
icp canister call frontend grant_permission '(record { to_principal = principal "<principal-id>"; permission = variant { Prepare } })'

# Grant full commit permission
icp canister call frontend grant_permission '(record { to_principal = principal "<principal-id>"; permission = variant { Commit } })'

# List current permissions
icp canister call frontend list_permitted '(record { permission = variant { Commit } })'
```

## Deploy & Test

### Local Deployment

```bash
# Start the local replica
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
# Local:   http://<frontend-canister-id>.localhost:4943
# Mainnet: https://<frontend-canister-id>.ic0.app

# 6. Get canister ID
icp canister id frontend
# Expected: prints the canister ID (e.g., "bkyz2-fmaaa-aaaaa-qaaaq-cai")

# 7. Check storage usage
icp canister info frontend
# Shows memory usage, module hash, controllers
```
