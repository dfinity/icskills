---
name: custom-domains
description: "Register and manage custom domains for IC canisters via the HTTP gateway custom domain service. Covers DNS record configuration (CNAME, TXT, ACME challenge), the .well-known/ic-domains file, domain registration/validation/update/deletion via the REST API, TLS certificate provisioning, and HttpAgent host configuration. Use when the user wants to serve a canister under a custom domain, configure DNS for IC, register a domain with boundary nodes, troubleshoot custom domain issues, or update/remove a custom domain. Do NOT use for general frontend hosting or asset canister configuration without custom domains — use asset-canister instead."
license: Apache-2.0
compatibility: "curl, DNS registrar access, deployed canister"
metadata:
  title: "Custom Domains"
  category: Frontend
---

# Custom Domains

## What This Is

By default, canisters are accessible at `<canister-id>.icp0.io`. The custom domains service lets you serve any canister under your own domain (e.g., `yourdomain.com`). You configure DNS, deploy a domain ownership file to your canister, and register via a REST API. The HTTP gateways then handle TLS certificate provisioning, renewal, and routing automatically.

Custom domains work at the boundary node level — they map a domain to any canister ID via DNS. This works with any canister that can serve `/.well-known/ic-domains` over HTTP, not just asset canisters. That includes asset canisters, Juno satellites, and custom canisters implementing `http_request`.

## Prerequisites

- A registered domain from any registrar (e.g., Namecheap, GoDaddy, Cloudflare)
- Access to edit DNS records for that domain
- A deployed canister that serves `/.well-known/ic-domains` over HTTP (asset canisters, Juno satellites, or any canister implementing `http_request`)
- `curl` for the registration API calls
- `jq` (optional, for formatting JSON responses)

## Mistakes That Break Your Setup

1. **Not disabling your DNS provider's SSL/TLS.** Providers like Cloudflare enable Universal SSL by default. This interferes with the ACME challenge the IC uses to provision certificates and can prevent certificate renewal. Disable any certificate/SSL/TLS offering from your DNS provider before registering.

2. **Setting a CNAME on the apex domain.** Many DNS providers don't allow CNAME records on the apex (e.g., `example.com` with no subdomain). Use ANAME or ALIAS record types (CNAME flattening) if your provider supports them. Otherwise, use a subdomain like `www.example.com`.

3. **Missing the `_acme-challenge` CNAME.** Without `_acme-challenge.CUSTOM_DOMAIN` pointing to `_acme-challenge.CUSTOM_DOMAIN.icp2.io`, the HTTP gateways cannot obtain a TLS certificate. Registration will fail.

4. **Multiple TXT records on `_canister-id`.** If more than one TXT record exists for `_canister-id.CUSTOM_DOMAIN`, registration fails. Keep exactly one containing your canister ID.

5. **Forgetting the `.well-known/ic-domains` file.** The canister must serve `/.well-known/ic-domains` listing your custom domain. Without it, domain ownership verification fails during registration.

6. **Stale `_acme-challenge` TXT records from your DNS provider.** Previous ACME challenges by your provider may leave TXT records on `_acme-challenge.CUSTOM_DOMAIN` that don't appear in your dashboard. These conflict with the IC's ACME flow. Disable all TLS offerings from your provider to clear them. Verify with `dig TXT _acme-challenge.CUSTOM_DOMAIN`.

7. **Not explicitly registering the domain.** DNS configuration alone is not enough. You must call `POST /custom-domains/v1/CUSTOM_DOMAIN` to start registration. It is not automatic.

8. **Not setting `host` in HttpAgent on custom domains.** When serving from a custom domain, the `HttpAgent` cannot automatically infer the IC API host like it can on `icp0.io`. You must set `host: "https://icp-api.io"` explicitly for mainnet.

9. **Forgetting alternative origins for Internet Identity.** II principals depend on the origin domain. Switching from a canister URL to a custom domain changes principals. Configure `.well-known/ii-alternative-origins` to keep the same principals. See the `internet-identity` skill.

## Implementation

### Step 1: Configure DNS Records

Add three DNS records (replace `CUSTOM_DOMAIN` with your domain, e.g., `app.example.com`):

| Record Type | Host | Value |
|---|---|---|
| CNAME | `CUSTOM_DOMAIN` | `CUSTOM_DOMAIN.icp1.io` |
| TXT | `_canister-id.CUSTOM_DOMAIN` | your canister ID (e.g., `hwvjt-wqaaa-aaaam-qadra-cai`) |
| CNAME | `_acme-challenge.CUSTOM_DOMAIN` | `_acme-challenge.CUSTOM_DOMAIN.icp2.io` |

Some DNS providers omit the main domain suffix. For `app.example.com` on such providers:
- `app` instead of `app.example.com`
- `_canister-id.app` instead of `_canister-id.app.example.com`
- `_acme-challenge.app` instead of `_acme-challenge.app.example.com`

For apex domains without CNAME support, use your provider's ANAME or ALIAS record type pointing to `CUSTOM_DOMAIN.icp1.io`.

### Step 2: Create the `ic-domains` File

Your canister must serve `/.well-known/ic-domains` over HTTP. Create this file listing each custom domain on its own line:

```text
app.example.com
www.example.com
```

**Asset canister users:** place `.well-known/` inside your `public/` directory (Vite projects) or alongside your source files, and ensure `.ic-assets.json5` includes `{ "match": ".well-known", "ignore": false }` so the hidden directory gets deployed. See the `asset-canister` skill for details on file placement.

**Custom `http_request` canisters:** serve the file contents at `/.well-known/ic-domains` directly from your HTTP request handler.

### Step 3: Deploy

Deploy your canister so that `/.well-known/ic-domains` is accessible at `https://<canister-id>.icp0.io/.well-known/ic-domains`.

### Step 4: Validate

Check DNS records and canister configuration before registering:

```bash
curl -sL -X GET "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN/validate" | jq
```

Success response:

```json
{
  "status": "success",
  "message": "Domain is eligible for registration: DNS records are valid and canister ownership is verified",
  "data": {
    "domain": "CUSTOM_DOMAIN",
    "canister_id": "CANISTER_ID",
    "validation_status": "valid"
  }
}
```

If validation fails, common errors and fixes:

| Error | Fix |
|---|---|
| Missing DNS CNAME record | Add the `_acme-challenge` CNAME pointing to `_acme-challenge.CUSTOM_DOMAIN.icp2.io` |
| Missing DNS TXT record | Add the `_canister-id` TXT record with your canister ID |
| Invalid DNS TXT record | Ensure the TXT value is a valid canister ID |
| More than one DNS TXT record | Remove duplicate `_canister-id` TXT records, keep one |
| Failed to retrieve known domains | Ensure `.well-known/ic-domains` is deployed and served by the canister |
| Domain missing from list | Add the domain to the `ic-domains` file and redeploy |

### Step 5: Register

```bash
curl -sL -X POST "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

Success response:

```json
{
  "status": "success",
  "message": "Domain registration request accepted and may take a few minutes to process",
  "data": {
    "domain": "CUSTOM_DOMAIN",
    "canister_id": "CANISTER_ID"
  }
}
```

### Step 6: Wait for Certificate Provisioning

Poll until `registration_status` is `registered`:

```bash
curl -sL -X GET "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

Status values: `registering` → `registered` (success), or `failed` (check error message).

After `registered`, wait a few more minutes for propagation to all HTTP gateways before testing.

## Updating a Custom Domain

To point an existing custom domain at a different canister:

1. Update the `_canister-id` TXT record to the new canister ID.
2. Notify the service:

```bash
curl -sL -X PATCH "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

3. Check status:

```bash
curl -sL -X GET "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

## Removing a Custom Domain

1. Remove the `_canister-id` TXT record and `_acme-challenge` CNAME from DNS.
2. Notify the service:

```bash
curl -sL -X DELETE "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

3. Confirm deletion (should return 404):

```bash
curl -sL -X GET "https://icp0.io/custom-domains/v1/CUSTOM_DOMAIN" | jq
```

## HttpAgent Configuration

On custom domains, the agent cannot auto-detect the IC API host. Set it explicitly:

```typescript
import { HttpAgent } from "@icp-sdk/core/agent";

const isProduction = process.env.NODE_ENV === "production";
const host = isProduction ? "https://icp-api.io" : undefined;
const agent = await HttpAgent.create({ host });
```

## Deploy & Test

```bash
# 1. Deploy your canister with the ic-domains file served at /.well-known/ic-domains

# 2. Validate DNS + canister config
curl -sL -X GET "https://icp0.io/custom-domains/v1/yourdomain.com/validate" | jq

# 3. Register
curl -sL -X POST "https://icp0.io/custom-domains/v1/yourdomain.com" | jq

# 4. Poll until registered
curl -sL -X GET "https://icp0.io/custom-domains/v1/yourdomain.com" | jq
```

## Verify It Works

```bash
# 1. Verify DNS records
dig CNAME yourdomain.com
# Expected: yourdomain.com. CNAME yourdomain.com.icp1.io.

dig TXT _canister-id.yourdomain.com
# Expected: "<your-canister-id>"

dig CNAME _acme-challenge.yourdomain.com
# Expected: _acme-challenge.yourdomain.com. CNAME _acme-challenge.yourdomain.com.icp2.io.

# 2. Verify ic-domains file is served by the canister
curl -sL "https://<canister-id>.icp0.io/.well-known/ic-domains"
# Expected: your domain listed

# 3. Verify registration status is "registered"
curl -sL -X GET "https://icp0.io/custom-domains/v1/yourdomain.com" | jq '.data.registration_status'
# Expected: "registered"

# 4. Verify the custom domain serves your canister
curl -sI "https://yourdomain.com"
# Expected: HTTP/2 200

# 5. Verify no stale ACME TXT records
dig TXT _acme-challenge.yourdomain.com
# Expected: no TXT records (only the CNAME)
```
