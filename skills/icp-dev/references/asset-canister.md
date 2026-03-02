# Asset Canister & Frontend Hosting

The asset canister hosts static files (HTML, CSS, JS, images) directly on the Internet Computer. Responses are certified by the subnet, and HTTP gateways automatically verify integrity.

## Canister IDs

Asset canisters are created per-project. After deployment, you can lookup your canister id by calling `icp canister -e <environment> <canister-name> --id-only`.

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

6. **Exceeding canister storage limits.** Individual assets are limited by the 2MB ingress message size (the asset manager in `@icp-sdk/canisters` handles chunking automatically for uploads >1.9MB). Large media files become expensive in cycle cost for storage.

7. **Not configuring `allow_raw_access` correctly.** By default, `allow_raw_access` is `true`, meaning assets are also available on the raw domain (`raw.ic0.app` / `raw.icp0.io`) where no verification occurs. Set `"allow_raw_access": false` in `.ic-assets.json5` for any sensitive assets.

## Key Patterns

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

### SPA Routing: `.ic-assets.json5`

Place in your `source` directory (or `public/`/`static/` so the build tool copies it into `dist/`):

```json5
[
  {
    "match": "**/*",
    "security_policy": "standard",
    "headers": {
      "Cache-Control": "public, max-age=0, must-revalidate"
    },
    "allow_raw_access": false
  },
  {
    "match": "assets/**/*",
    "headers": {
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  },
  {
    "match": "**/*",
    "enable_aliasing": true
  }
]
```

The critical SPA setting is `"enable_aliasing": true` -- this serves `index.html` when a requested path has no matching file.

### Custom Domain Setup

1. Create `.well-known/ic-domains` in your `source` directory:
```text
yourdomain.com
www.yourdomain.com
```

2. Add DNS records:
```text
yourdomain.com.  CNAME  icp1.io.
_acme-challenge.yourdomain.com.  CNAME  _acme-challenge.<your-canister-id>.icp2.io.
_canister-id.yourdomain.com.  TXT  "<your-canister-id>"
```

### Programmatic Uploads (JavaScript)

```javascript
import { AssetManager } from "@icp-sdk/canisters/assets";
import { HttpAgent } from "@icp-sdk/core/agent";

const agent = await HttpAgent.create({
  host: "http://localhost:4943",
  shouldFetchRootKey: true, // NEVER true on mainnet
});

const assetManager = new AssetManager({
  canisterId: "your-asset-canister-id",
  agent,
});

// Upload (files >1.9MB are automatically chunked)
const key = await assetManager.store(fileBuffer, {
  fileName: "photo.jpg",
  contentType: "image/jpeg",
  path: "/uploads",
});
```
