---
id: oisy-wallet-signer
name: OISY Wallet Signer
category: IC-Wallet
description: Guides integration with @dfinity/oisy-wallet-signer for building dApps (relying party) and wallet UIs (signer) on the Internet Computer using ICRC-21/25/27/29/49 standards. Load when the user mentions OISY, wallet signer, relying party, consent messages, token transfers via signer, or canister call signing.
version: 4.1.0
endpoints: 5
status: stable
dependencies: [@dfinity/utils, @dfinity/zod-schemas, @icp-sdk/canisters, @icp-sdk/core, zod]
---

# OISY Wallet Signer
> version: 4.1.0 | requires: [@dfinity/utils >= 4.1, @dfinity/zod-schemas >= 3, @icp-sdk/canisters >= 3.2, @icp-sdk/core >= 5, zod >= 4]

## What This Is

A TypeScript library that enables secure communication between dApps and wallets on the Internet Computer using JSON-RPC 2.0 over `window.postMessage`. OISY signer = **explicit per-action approval**. `connect()` establishes a channel. Nothing more.

**It is not:**
- A session system
- A delegated identity (no ICRC-34)
- A background executor

**ICRC standards implemented:**
- ICRC-21 — Canister call consent messages
- ICRC-25 — Signer interaction standard (permissions)
- ICRC-27 — Accounts
- ICRC-29 — Window PostMessage transport
- ICRC-49 — Call canister

**Not yet implemented:**
- ICRC-46 — Session-based delegation (not supported; use a delegation-capable model if you need sessions)

## When to Use

- Clear, intentional, high-value actions: token transfers (ICP / ICRC-1 / ICRC-2), NFT mint/claim, single approvals
- Funding / deposit flows: "Top up", "Deposit into protocol"
- Any action where a confirmation dialog per operation feels natural

## When NOT to Use

- **Delegation or sessions**: sign once / act many times, background execution, autonomous behavior
- **High-frequency interactions**: games, social actions, rapid write operations
- **Invisible writes**: autosave, cron jobs, auto-compounding

> **Decision test:** If your app still feels good when every meaningful update shows a confirmation dialog, OISY is appropriate. If not, use a delegation-capable model instead.

## Prerequisites

- Node.js >= 24
- npm >= 11.5.1 (< 12.0.0)
- `@dfinity/oisy-wallet-signer` installed
- Peer dependencies installed: `@dfinity/utils`, `@dfinity/zod-schemas`, `@icp-sdk/canisters`, `@icp-sdk/core`, `zod`
- A non-anonymous identity on the signer side (e.g. `Ed25519KeyIdentity`)
- For local development: a running IC replica (`dfx start`)

```bash
npm i @dfinity/oisy-wallet-signer @dfinity/utils @dfinity/zod-schemas @icp-sdk/canisters @icp-sdk/core zod
```

## Mistakes That Break Your Build

1. **Importing classes from the wrong entry point.** `Signer`, `RelyingParty`, `IcpWallet`, and `IcrcWallet` are **not** exported from the main entry point. Import them from their dedicated subpaths or you get `undefined`.

   ```typescript
   // WRONG — will fail
   import {Signer} from '@dfinity/oisy-wallet-signer';

   // CORRECT
   import {Signer} from '@dfinity/oisy-wallet-signer/signer';
   import {IcpWallet} from '@dfinity/oisy-wallet-signer/icp-wallet';
   import {IcrcWallet} from '@dfinity/oisy-wallet-signer/icrc-wallet';
   ```

2. **Using `IcrcWallet` without `ledgerCanisterId`.** Unlike `IcpWallet` (which defaults to the ICP ledger `ryjl3-tyaaa-aaaaa-aaaba-cai`), `IcrcWallet.transfer()`, `.approve()`, and `.transferFrom()` all **require** `ledgerCanisterId`. Omitting it causes a runtime error.

3. **Forgetting to register prompts on the signer side.** The signer returns error 501 (`PERMISSIONS_PROMPT_NOT_REGISTERED`) if a request arrives and no prompt handler is registered for it. Register all four prompts (`ICRC25_REQUEST_PERMISSIONS`, `ICRC27_ACCOUNTS`, `ICRC21_CALL_CONSENT_MESSAGE`, `ICRC49_CALL_CANISTER`) before the signer can handle any relying party traffic.

4. **Sending concurrent requests to the signer.** The signer processes one request at a time. A second request while one is in-flight returns error 503 (`BUSY`). Serialize your calls — wait for each response before sending the next. Read-only methods (`icrc29_status`, `icrc25_supported_standards`) are exempt.

5. **Assuming `connect()` = authenticated session.** `connect()` only opens a `postMessage` channel. The user has granted nothing yet — no permissions, no accounts, no identity delegation. Always call `requestPermissionsNotGranted()` after connecting.

6. **Not handling the consent message state machine.** The `ICRC21_CALL_CONSENT_MESSAGE` prompt fires multiple times with different statuses: `loading` → `result` | `error`. If you only handle `result`, the UI breaks on loading and error states. Always branch on `payload.status`.

7. **`sender` not matching `owner`.** The signer validates that `sender` in every `icrc49_call_canister` request matches the signer's `owner` identity. A mismatch returns error 502 (`SENDER_NOT_ALLOWED`). Always use the `owner` from `accounts()`.

8. **Not calling `disconnect()`.** Both `Signer.disconnect()` and `wallet.disconnect()` must be called on cleanup. Forgetting this leaks event listeners and leaves popup windows open.

9. **Ignoring permission expiration.** Permissions default to a 7-day validity period. After expiry, they silently revert to `ask_on_use`. Don't cache permission state client-side beyond a session.

10. **Auto-triggering signing on connect.** Never fire a canister call immediately after `connect()`. Let the user initiate the action. The signer is designed for intentional, user-driven operations.

## Implementation

### Import Map

```typescript
// Constants and types — from main entry point
import {
  ICRC25_REQUEST_PERMISSIONS,
  ICRC25_PERMISSION_GRANTED,
  ICRC25_PERMISSION_DENIED,
  ICRC25_PERMISSION_ASK_ON_USE,
  ICRC27_ACCOUNTS,
  ICRC21_CALL_CONSENT_MESSAGE,
  ICRC49_CALL_CANISTER,
  DEFAULT_SIGNER_WINDOW_CENTER,
  DEFAULT_SIGNER_WINDOW_TOP_RIGHT
} from '@dfinity/oisy-wallet-signer';

import type {
  PermissionsPromptPayload,
  AccountsPromptPayload,
  ConsentMessagePromptPayload,
  CallCanisterPromptPayload,
  IcrcAccounts,
  SignerOptions,
  RelyingPartyOptions
} from '@dfinity/oisy-wallet-signer';

// Classes — from dedicated subpaths
import {Signer} from '@dfinity/oisy-wallet-signer/signer';
import {RelyingParty} from '@dfinity/oisy-wallet-signer/relying-party';
import {IcpWallet} from '@dfinity/oisy-wallet-signer/icp-wallet';
import {IcrcWallet} from '@dfinity/oisy-wallet-signer/icrc-wallet';
```

### dApp Side (Relying Party)

#### Choosing the Right Class

| Class | Use for |
|-------|---------|
| `IcpWallet` | ICP ledger operations — `ledgerCanisterId` optional (defaults to ICP ledger) |
| `IcrcWallet` | Any ICRC ledger — `ledgerCanisterId` **required** |
| `RelyingParty` | Low-level custom canister calls via protected `call()` |

#### Connect, Permissions, Accounts

```typescript
const wallet = await IcrcWallet.connect({
  url: 'https://oisy.com/sign',
  host: 'https://icp-api.io',
  windowOptions: {width: 576, height: 625, position: 'center'},
  connectionOptions: {timeoutInMilliseconds: 120_000},
  onDisconnect: () => { /* wallet popup closed */ }
});

const {allPermissionsGranted} = await wallet.requestPermissionsNotGranted();

const accounts = await wallet.accounts();
const {owner} = accounts[0];
```

#### IcpWallet — ICP Transfers and Approvals

```typescript
const wallet = await IcpWallet.connect({url: 'https://oisy.com/sign'});

const blockHeightTransfer = await wallet.icrc1Transfer({
  owner,
  request: {
    to: {owner: recipientPrincipal, subaccount: []},
    amount: 100_000_000n
  }
});

const blockHeightApprove = await wallet.icrc2Approve({
  owner,
  request: {
    spender: {owner: spenderPrincipal, subaccount: []},
    amount: 500_000_000n
  }
});
```

#### IcrcWallet — Any ICRC Ledger

```typescript
const wallet = await IcrcWallet.connect({url: 'https://oisy.com/sign'});

const blockIndexTransfer = await wallet.transfer({
  owner,
  ledgerCanisterId: 'mxzaz-hqaaa-aaaar-qaada-cai',
  params: {
    to: {owner: recipientPrincipal, subaccount: []},
    amount: 1_000_000n
  }
});

const blockIndexApprove = await wallet.approve({
  owner,
  ledgerCanisterId: 'mxzaz-hqaaa-aaaar-qaada-cai',
  params: {
    spender: {owner: spenderPrincipal, subaccount: []},
    amount: 5_000_000n
  }
});

const blockIndexTransferFrom = await wallet.transferFrom({
  owner,
  ledgerCanisterId: 'mxzaz-hqaaa-aaaar-qaada-cai',
  params: {
    from: {owner: fromPrincipal, subaccount: []},
    to: {owner: toPrincipal, subaccount: []},
    amount: 1_000_000n
  }
});
```

#### Query Methods and Disconnect

```typescript
const standards = await wallet.supportedStandards();
const currentPermissions = await wallet.permissions();

await wallet.disconnect();
```

#### Error Handling (dApp Side)

```typescript
try {
  await wallet.transfer({...});
} catch (err) {
  if (err instanceof RelyingPartyResponseError) {
    switch (err.code) {
      case 3000: /* PERMISSION_NOT_GRANTED */ break;
      case 3001: /* ACTION_ABORTED — user rejected */ break;
      case 4000: /* NETWORK_ERROR */ break;
    }
  }
  if (err instanceof RelyingPartyDisconnectedError) {
    /* popup closed unexpectedly */
  }
}
```

### Wallet Side (Signer)

#### Initialize and Register All Prompts

```typescript
const signer = Signer.init({
  owner: identity,
  host: 'https://icp-api.io',
  sessionOptions: {
    sessionPermissionExpirationInMilliseconds: 7 * 24 * 60 * 60 * 1000
  }
});

signer.register({
  method: ICRC25_REQUEST_PERMISSIONS,
  prompt: ({requestedScopes, confirm, origin}: PermissionsPromptPayload) => {
    confirm(requestedScopes.map(({scope}) => ({
      scope,
      state: userApproved ? ICRC25_PERMISSION_GRANTED : ICRC25_PERMISSION_DENIED
    })));
  }
});

signer.register({
  method: ICRC27_ACCOUNTS,
  prompt: ({approve, reject, origin}: AccountsPromptPayload) => {
    approve([{owner: identity.getPrincipal().toText()}]);
  }
});

signer.register({
  method: ICRC21_CALL_CONSENT_MESSAGE,
  prompt: (payload: ConsentMessagePromptPayload) => {
    if (payload.status === 'loading') {
      // show spinner
    } else if (payload.status === 'result') {
      // payload.consentInfo: { Ok: ... } (from canister) or { Warn: ... } (signer-generated fallback)
      // show consent UI, then: payload.approve() or payload.reject()
    } else if (payload.status === 'error') {
      // show error, optionally payload.details
    }
  }
});

signer.register({
  method: ICRC49_CALL_CANISTER,
  prompt: (payload: CallCanisterPromptPayload) => {
    if (payload.status === 'executing') { /* show progress */ }
    else if (payload.status === 'result') { /* call succeeded */ }
    else if (payload.status === 'error') { /* call failed */ }
  }
});
```

#### Consent Message: Ok vs Warn

- `{ Ok: consentInfo }` — canister implements ICRC-21; message is canister-verified
- `{ Warn: { consentInfo, canisterId, method, arg } }` — signer generated a fallback (for `icrc1_transfer`, `icrc2_approve`, `icrc2_transfer_from`)

Always distinguish these in the UI — warn the user when the message is signer-generated.

#### Disconnect

```typescript
signer.disconnect();
```

### Error Code Reference

| Code | Name | Meaning |
|------|------|---------|
| 500 | `ORIGIN_ERROR` | Origin mismatch |
| 501 | `PERMISSIONS_PROMPT_NOT_REGISTERED` | Missing prompt handler |
| 502 | `SENDER_NOT_ALLOWED` | `sender` ≠ `owner` |
| 503 | `BUSY` | Concurrent request rejected |
| 504 | `NOT_INITIALIZED` | Owner identity not set |
| 1000 | `GENERIC_ERROR` | Catch-all |
| 2000 | `REQUEST_NOT_SUPPORTED` | Method not supported |
| 3000 | `PERMISSION_NOT_GRANTED` | Permission denied |
| 3001 | `ACTION_ABORTED` | User cancelled |
| 4000 | `NETWORK_ERROR` | IC call failure |

### Permission States

| State | Constant | Behavior |
|-------|----------|----------|
| Granted | `ICRC25_PERMISSION_GRANTED` | Proceeds without prompting |
| Denied | `ICRC25_PERMISSION_DENIED` | Rejected immediately (error 3000) |
| Ask on use | `ICRC25_PERMISSION_ASK_ON_USE` | Prompts user on access (default) |

Permissions stored in `localStorage` as `oisy_signer_{origin}_{owner}` with timestamps. Default validity: 7 days.

### Typical End-to-End Lifecycle

```
1. dApp: IcrcWallet.connect({url})              → opens popup, polls icrc29_status
2. dApp: wallet.requestPermissionsNotGranted()   → prompts user if needed
3. dApp: wallet.accounts()                       → signer prompts, returns accounts
4. dApp: wallet.transfer({...})                  → signer fetches ICRC-21 consent message
                                                    → signer prompts user with consent
                                                    → signer executes canister call
                                                    → returns block index
5. dApp: wallet.disconnect()                     → closes popup, cleans up
```

## Deploy & Test

### Local Development

Start a local IC replica and pass `host` to both sides:

```bash
dfx start --background
```

```typescript
// dApp side
const wallet = await IcrcWallet.connect({
  url: 'http://localhost:5173/sign',
  host: 'http://localhost:4943'
});

// Wallet side
const signer = Signer.init({
  owner: identity,
  host: 'http://localhost:4943'
});
```

### Running Unit Tests

```bash
npm test
```

### Running E2E Tests

Requires Playwright and a local replica:

```bash
npm run e2e
```

### Building the Library

```bash
npm run build
```

Output goes to `dist/` as ESM with TypeScript declarations and source maps.

## Verify It Works

```bash
# Unit tests pass
npm test

# E2E tests pass (connection, permissions, transfers, approvals, disconnect)
npm run e2e

# TypeScript compiles without errors
npx tsc --noEmit

# Lint passes
npm run lint

# Build succeeds
npm run build && ls dist/index.js dist/signer.js dist/relying-party.js dist/icp-wallet.js dist/icrc-wallet.js
```

After connecting in the browser: the signer popup opens, `icrc29_status` returns `"ready"`, permissions can be requested, and `wallet.accounts()` returns at least one account with a valid principal.
