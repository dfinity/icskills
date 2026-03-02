# IC Dashboard APIs

Public REST APIs that power **dashboard.internetcomputer.org**. Read-only access to canister metadata, ICRC ledgers, SNS data, the ICP ledger, and network metrics. No canister deployment or cycles required.

## API Base URLs and Docs

| API | Base URL | OpenAPI spec | Swagger / Docs | Prefer |
|-----|----------|--------------|----------------|--------|
| IC API | `https://ic-api.internetcomputer.org` | `/api/v3/openapi.json` | `/api/v3/swagger` | v4 for canisters, subnets (cursor pagination) |
| ICRC API | `https://icrc-api.internetcomputer.org` | `/openapi.json` | `/docs` | v2 for ledgers (TestICP and other ICRC tokens; **not** mainnet ICP) |
| SNS API | `https://sns-api.internetcomputer.org` | `/openapi.json` | `/docs` | v2 for snses, proposals, neurons |
| Ledger API (mainnet ICP) | `https://ledger-api.internetcomputer.org` | `/openapi.json` | `/swagger-ui/` | Use for **ICP token**; v2 for cursor pagination |
| Metrics API | `https://metrics-api.internetcomputer.org` | `/api/v1/openapi.json` | `/api/v1/docs` | v1 (no newer version) |

## Mistakes That Break Your Build

1. **Wrong base URL or API version.** IC API uses `/api/v3/` (and v4 for canisters/subnets); ICRC has `/api/v1/` and `/api/v2/` (ICRC API does not serve mainnet ICP -- use Ledger API). Ledger API uses unversioned paths for some endpoints and `/v2/` for cursor-paginated lists. Metrics API uses `/api/v1/`. Using the wrong prefix returns 404 or wrong schema.

2. **Canister ID format.** Canister IDs must match the principal-like pattern: 27 characters, five groups of five plus a final three (e.g. `ryjl3-tyaaa-aaaaa-aaaba-cai`). Subnet IDs use the longer pattern (e.g. 63 chars). Wrong encoding or length causes 422 or 400.

3. **Using ICRC API for mainnet ICP.** ICRC API exposes **test ICP (TestICP) only**, not mainnet ICP. For mainnet ICP token data (accounts, transactions, supply) use **Ledger API** (`ledger-api.internetcomputer.org`).

4. **ICRC API: ledger_canister_id in path.** ICRC endpoints require `ledger_canister_id` in the path (e.g. `/api/v2/ledgers/{ledger_canister_id}/transactions`). Use the canister ID of the ledger you want (e.g. ckBTC `mxzaz-hqaaa-aaaar-qaada-cai`).

5. **Using v1 or offset-based pagination when v2+ exists.** Always prefer v2+ endpoints with cursor pagination (`after`, `before`, `limit`). Older v1/offset endpoints are legacy.

6. **Timestamps.** Most time-range params (`start`, `end`) expect Unix seconds (integer). Sending milliseconds or ISO strings causes 422.

7. **Account identifier format.** Ledger API uses **account identifiers** (64-char hex hashes), not raw principals, for account-specific paths.

8. **Assuming authentication.** These public APIs do not require API keys or auth for read endpoints.

## Key Patterns

### IC API -- Canisters (v4, cursor pagination)

```bash
curl -s "https://ic-api.internetcomputer.org/api/v4/canisters?limit=5"
# Get one canister (v3)
curl -s "https://ic-api.internetcomputer.org/api/v3/canisters/ryjl3-tyaaa-aaaaa-aaaba-cai"
```

### ICRC API -- Other ICRC ledgers only (not mainnet ICP)

```bash
curl -s "https://icrc-api.internetcomputer.org/api/v2/ledgers/mxzaz-hqaaa-aaaar-qaada-cai/transactions?limit=5"
```

### SNS API

```bash
curl -s "https://sns-api.internetcomputer.org/api/v2/snses?limit=10"
```

### Ledger API -- Mainnet ICP

```bash
curl -s "https://ledger-api.internetcomputer.org/v2/accounts?limit=10"
curl -s "https://ledger-api.internetcomputer.org/supply/total/latest"
```

### Metrics API

```bash
curl -s "https://metrics-api.internetcomputer.org/api/v1/icp-xdr-conversion-rates?start=1700000000&end=1700086400&step=86400"
```
