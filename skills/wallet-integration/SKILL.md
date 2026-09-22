---
name: wallet-integration
description: "Integrate an external wallet (signer) into an IC dapp with @icp-sdk/signer — the relying-party side of the ICRC signer standards. Covers picking a transport (popup via ICRC-29 / top-level redirect via ICRC-167 / browser extension via ICRC-94) and then negotiating capabilities and driving the permission and account lifecycle. Shows both interaction models: per-action approval through SignerAgent (ICRC-49) and session delegation (ICRC-34). Uses OISY as the worked example but applies to any ICRC-25 signer. Do NOT use for Internet Identity login (use the internet-identity skill) or for implementing a wallet yourself. Use when the developer mentions wallet integration or OISY or @icp-sdk/signer or approving a transaction in a wallet popup."
license: Apache-2.0
compatibility: "Node.js >= 22, a browser (secure context: HTTPS, localhost, or 127.0.0.1)"
metadata:
  title: Wallet Integration
  category: DeFi
---

# Wallet Integration

## What This Is

Connecting an **external wallet** to your dapp so the user approves actions in the wallet rather than handing your app a key. `@icp-sdk/signer` is the **relying-party** client: your app is the relying party, the wallet is the signer, and they exchange JSON-RPC 2.0 messages over a transport defined by the ICRC signer standards.

This skill covers **integrating a signer**. Implementing one is out of scope — consent screens, prompt registration and account custody are the wallet's job.

Examples use [OISY](https://oisy.com) (`https://oisy.com/sign`), but nothing here is OISY-specific: any ICRC-25 signer works by swapping the transport URL, and [`BrowserExtensionTransport`](#extension-icrc-94) discovers extension signers you never hardcoded.

| Standard | What it gives you | API |
|----------|-------------------|-----|
| ICRC-25 | Capability discovery + permission lifecycle | `getSupportedStandards`, `requestPermissions`, `getPermissions` |
| ICRC-27 | The user's accounts | `getAccounts` |
| ICRC-29 | Popup transport over `postMessage` | `PostMessageTransport` |
| ICRC-34 | Session delegation | `requestDelegation` |
| ICRC-49 | Execute a canister call | `callCanister`, `SignerAgent` |
| ICRC-94 | Browser-extension discovery | `BrowserExtensionTransport.discover` |
| ICRC-95 | Identity derivation origin | `derivationOrigin` option |
| ICRC-167 | Top-level redirect transport | `UrlTransport` (**new in signer 6**) |

## Choose an interaction model first

Everything downstream follows from this choice.

| | **Path A — per-action approval** (ICRC-49) | **Path B — session delegation** (ICRC-34) |
|---|---|---|
| The user approves | every write, individually | once, at sign-in |
| Your app holds | no key — the wallet signs | a session key the wallet delegated to |
| You end up with | a `SignerAgent` | an ordinary `HttpAgent` + `DelegationIdentity` |
| Good for | transfers, approvals, mints — deliberate, high-value acts | games, social, frequent writes, background work |
| Bad for | anything frequent; each call is a popup | acts a user should consciously confirm |

A signer may support one and not the other — negotiate before you commit (see below). You can also combine them: a delegation for your own canister, per-action approval for token transfers.

### When NOT to use this skill

- **Internet Identity sign-in** → the **internet-identity** skill. II is an identity provider, not an ICRC-25 signer.
- **Letting an agent or CLI act as the user** → the **agent-web-identity** skill.
- **Building a wallet** → out of scope, as above.

## Prerequisites

```bash
npm i '@icp-sdk/signer@^6' '@icp-sdk/core@^6'
```

Add `@icp-sdk/canisters@^4` if you call ICP/ICRC ledgers (it brings `@dfinity/utils@^5` as a peer). Pin `@icp-sdk/core` to `^6`: signer 6 peers it, and so do `@icp-sdk/auth@^10` and `@icp-sdk/canisters@^4`.

The transport URL must be a **secure context** — HTTPS, `localhost`, or `127.0.0.1`.

## Pick a transport

The transport is the only part that knows *how* the wallet is reached; the `Signer` API above it is identical either way.

| Transport | Mechanism | Use when |
|-----------|-----------|----------|
| `PostMessageTransport` | Popup, handshaken with `icrc29_status`, then `postMessage` | Default for web wallets like OISY |
| `UrlTransport` | Navigates the top-level window; wallet returns to your `callbackUrl` | Mobile, or anywhere popups are blocked |
| `BrowserExtensionTransport` | Extensions announce themselves on `window` events | Extension wallets; discovering unknown signers |

```typescript
import { Signer } from '@icp-sdk/signer';
import { PostMessageTransport } from '@icp-sdk/signer/web';

// One Signer per wallet connection; safe to create at module scope.
const signer = new Signer({
  transport: new PostMessageTransport({ url: 'https://oisy.com/sign' })
});
```

### Extension (ICRC-94)

```typescript
import { BrowserExtensionTransport } from '@icp-sdk/signer/extension';

async function pickExtensionSigner() {
  // Each provider carries { uuid, name, icon, rdns } — enough to render a picker.
  const providers = await BrowserExtensionTransport.discover();
  if (providers.length === 0) return null;

  const transport = await BrowserExtensionTransport.findTransport({ uuid: providers[0].uuid });
  return new Signer({ transport });
}
```

### Redirect (ICRC-167)

`UrlTransport` unloads your page on every request, so it keeps a call-order journal in `sessionStorage` and replays it when the wallet returns. Two rules make or break it:

1. **Issue the same requests, in the same order, on every load.** Branch only on values recovered from earlier results. A divergence guard rejects a replay that does not match.
2. **`memoize()` is the only place a flow may await anything that is not a signer request.** Its result is journaled, so a value stays stable across the redirect.

```typescript
import { Signer } from '@icp-sdk/signer';
import { UrlTransport } from '@icp-sdk/signer/web';
import { DelegationIdentity, Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import type { Principal } from '@icp-sdk/core/principal';

const transport = new UrlTransport({
  url: 'https://id.ai/icrc-167',
  // Absolute, fragment-free, on an origin you control, and listed in that
  // origin's /.well-known/ii-auth-callbacks allow-list.
  callbackUrl: 'https://app.example.com/signer-callback'
});

// Run this on the load of the callback route: a fresh arrival starts the flow,
// the wallet's return replays it. No separate resume or cleanup call.
async function runRedirectFlow(backend: Principal) {
  const signer = new Signer({ transport });

  // The session key must survive the redirect, so journal it. Ed25519KeyIdentity
  // is used because toJSON() is JSON-serializable; ECDSAKeyIdentity holds
  // CryptoKeys that are not (see pitfall 6).
  const sessionKeyJson = await transport.memoize(() =>
    JSON.stringify(Ed25519KeyIdentity.generate().toJSON())
  );
  const sessionKey = Ed25519KeyIdentity.fromJSON(sessionKeyJson);

  const chain = await signer.requestDelegation({
    publicKey: sessionKey.getPublicKey(),
    targets: [backend]
  });
  return DelegationIdentity.fromDelegation(sessionKey, chain);
}
```

## Negotiate capabilities

Skip this only if you hardcode one wallet and know what it supports. For generic integration it is the step that keeps you honest — ICRC-34 and ICRC-49 are independent, and a signer may offer either, both, or neither.

```typescript
async function capabilities(signer: Signer) {
  const standards = await signer.getSupportedStandards(); // [{ name: 'ICRC-27', url }, ...]
  const names = new Set(standards.map(({ name }) => name));
  return {
    canCallCanisters: names.has('ICRC-49'),  // Path A
    canDelegate: names.has('ICRC-34')        // Path B
  };
}
```

`getSupportedStandards` needs no permission, so it is safe as a first call.

## Permissions and accounts

Permissions default to `ask_on_use`: the wallet prompts the first time each method is used. `requestPermissions` is **optional** — it trades several later prompts for one up front.

| State | Behaviour |
|-------|-----------|
| `granted` | Proceeds without prompting |
| `denied` | Rejected immediately with error `3000` |
| `ask_on_use` | Prompts on first use (the default) |

```typescript
async function connect(signer: Signer) {
  // Optional: ask once, up front, instead of per method.
  await signer.requestPermissions([
    { method: 'icrc27_accounts' },
    { method: 'icrc49_call_canister' }
  ]);

  const accounts = await signer.getAccounts();
  return {
    account: accounts[0].owner,          // a Principal, already decoded
    subaccount: accounts[0].subaccount   // Uint8Array | undefined
  };
}
```

`getPermissions()` reads the current state without prompting. Do not cache it across sessions — a wallet may expire grants, after which they silently revert to `ask_on_use`.

## Path A — per-action approval

`SignerAgent` implements `Agent`, so it drops into anything that takes one: a ledger client from `@icp-sdk/canisters`, or an actor from `@icp-sdk/bindgen` for your own canister. Each call becomes a wallet prompt.

```typescript
import { SignerAgent } from '@icp-sdk/signer/agent';
import { IcrcLedgerCanister } from '@icp-sdk/canisters/ledger/icrc';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';

const ICP_LEDGER = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');

// Two clients against the same ledger: one for reads, one for writes.
async function connectLedger(signer: Signer, account: Principal) {
  // One HttpAgent serves both. It answers reads directly, and SignerAgent
  // borrows it for the root key and status instead of building its own.
  const agent = await HttpAgent.create({ host: 'https://icp-api.io' });
  const signerAgent = await SignerAgent.create({ signer, account, agent });

  return {
    read: IcrcLedgerCanister.create({ agent, canisterId: ICP_LEDGER }),
    write: IcrcLedgerCanister.create({ agent: signerAgent, canisterId: ICP_LEDGER }),
    signerAgent
  };
}
```

**Read with the plain agent, write with the signer agent.** `SignerAgent.query()` upgrades every query into a full canister call routed through the wallet, so a balance check would become a user prompt and cost cycles:

```typescript
async function showBalanceThenTransfer(
  signer: Signer, account: Principal, to: Principal, amount: bigint
) {
  const { read, write, signerAgent } = await connectLedger(signer, account);

  const balance = await read.balance({ owner: account });                 // silent
  const block = await write.transfer({ to: { owner: to, subaccount: [] }, amount }); // prompts

  // Switches the account for later writes without rebuilding the agent.
  signerAgent.replaceAccount(account);

  return { balance, block };
}
```

## Path B — session delegation

The wallet delegates to a key your app generates. Afterwards you hold an ordinary `HttpAgent` and the wallet is not involved again until the delegation expires.

```typescript
import { HttpAgent } from '@icp-sdk/core/agent';
import { DelegationIdentity, ECDSAKeyIdentity } from '@icp-sdk/core/identity';

async function startSession(signer: Signer, backend: Principal) {
  // Non-extractable keys cannot be exfiltrated; prefer ECDSA when you do not
  // need to serialize the key (see pitfall 6 for the redirect case).
  const sessionKey = await ECDSAKeyIdentity.generate();

  const chain = await signer.requestDelegation({
    publicKey: sessionKey.getPublicKey(),
    // Scope it. Omitting targets asks for a delegation valid for ANY canister.
    targets: [backend],
    maxTimeToLive: BigInt(8) * BigInt(3_600_000_000_000) // 8 hours, in nanoseconds
  });

  const identity = DelegationIdentity.fromDelegation(sessionKey, chain);
  return HttpAgent.create({ identity });
}
```

`requestDelegation` **validates the wallet's response before returning** and throws if the chain does not terminate at your public key, if `targets` come back broader than requested, or if it outlives `maxTimeToLive`. Do not reimplement those checks, and do not swallow the throw — it is the guard against a malicious or buggy signer widening your delegation.

## Channel lifecycle and page reloads

`autoCloseTransportChannel` defaults to `true`: the channel closes ~200 ms after each response, so the popup does not linger. For a multi-step flow that awaits your own async work between requests, turn it off or the channel closes underneath you.

```typescript
async function multiStepFlow(signer: Signer) {
  signer.autoCloseTransportChannel = false;
  try {
    const accounts = await signer.getAccounts();
    await saveSelectionToYourBackend(accounts);  // your own async work; channel stays open
    return await signer.requestPermissions([{ method: 'icrc49_call_canister' }]);
  } finally {
    signer.autoCloseTransportChannel = true;
    await signer.closeChannel();
  }
}
```

**A connection does not survive a page reload.** There is no persistent session to restore — the channel is a live `postMessage` link to a popup that is gone. The workable pattern is to persist only the principal, render read-only state from it with an anonymous agent, and re-establish the signer lazily on the first write:

```typescript
const SESSION_KEY = 'wallet-principal';

// On connect: remember who, not the channel.
function rememberAccount(account: Principal) {
  sessionStorage.setItem(SESSION_KEY, account.toText());
}

// On reload: read-only state renders from this immediately, with no popup.
function restoreAccount(): Principal | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  return stored ? Principal.fromText(stored) : null;
}

// On the first write after a reload: this reopens the popup briefly.
async function ensureSignerAgent(signer: Signer, account: Principal, agent: HttpAgent) {
  await signer.getAccounts();  // re-establishes the channel
  return SignerAgent.create({ signer, account, agent });
}
```

Treat "disconnect" as clearing your own state — there is no wallet-side logout to call.

## Error handling

```typescript
import { Signer, SignerError } from '@icp-sdk/signer';
import { PostMessageTransportError } from '@icp-sdk/signer/web';
import { Principal } from '@icp-sdk/core/principal';

async function safeTransfer(
  signer: Signer, account: Principal, to: Principal, amount: bigint
) {
  try {
    await showBalanceThenTransfer(signer, account, to, amount);
  } catch (err) {
    if (err instanceof SignerError) {
      switch (err.code) {
        case 3001: return;                       // user cancelled — not a failure
        case 3000: showPermissionHelp(); return; // permission denied
        case 2000: showUnsupported(); return;    // wallet does not support the method
        case 4001: promptReconnect(); return;    // channel closed
        default: throw err;
      }
    }
    if (err instanceof PostMessageTransportError) {
      // Popup blocked, or the ICRC-29 handshake timed out.
      promptReconnect();
      return;
    }
    throw err;
  }
}
```

These are the ICRC-25 codes — the only ones portable across wallets:

| Code | Meaning | Handle by |
|------|---------|-----------|
| `1000` | Generic error | Surfacing `err.data` to developers |
| `2000` | Not supported | Negotiating capabilities first |
| `3000` | Permission not granted | Explaining what to re-grant |
| `3001` | **Action aborted — the user cancelled** | Returning quietly; this is normal |
| `4000` | Network error | Retrying |
| `4001` | Transport channel closed | Reconnecting |

Transport-level failures arrive as `PostMessageTransportError`, `UrlTransportError`, `BrowserExtensionTransportError`, or `SignerAgentError` — not as `SignerError`, because no wallet response was involved.

## Pitfalls

1. **Opening the popup outside a click handler.** `PostMessageTransport` rejects establishment that is not user-initiated (`detectNonClickEstablishment`, default `true`) because Safari and others block such popups. Connect from an event handler, never on mount or in a `useEffect`.

   ```typescript
   // WRONG — blocked, and the transport detects it
   useEffect(() => { signer.getAccounts(); }, []);

   // CORRECT
   button.addEventListener('click', () => signer.getAccounts());
   ```

2. **Reading through `SignerAgent`.** `query()` is upgraded to an update call routed through the wallet, so every read prompts the user and costs cycles. Reads go through a plain `HttpAgent`; only writes go through `SignerAgent`.

3. **Expecting a connection to survive a reload.** No channel outlives the page. Persist the principal for read-only rendering and reconnect on first write — see above.

4. **Assuming a wallet's capabilities.** Call `getSupportedStandards()`. A wallet that executes canister calls (ICRC-49) may not issue delegations (ICRC-34), and vice versa.

5. **Coding against one wallet's non-standard error codes.** Only `1000`/`2000`/`3000`/`3001`/`4000`/`4001` are ICRC-25. Vendor extensions outside that range are not portable — earlier revisions of this skill documented a `503 BUSY` code that exists only in `@dfinity/oisy-wallet-signer` and in no standard. Branch on the standard codes and treat the rest as generic.

6. **Journaling a non-serializable session key through `memoize()`.** `memoize` persists via JSON, so `ECDSAKeyIdentity` cannot cross a redirect — its `getKeyPair()` returns `CryptoKey`s that `JSON.stringify` silently reduces to `{}`, and the flow fails on return with a key it cannot sign with. Use `Ed25519KeyIdentity` (`toJSON`/`fromJSON`) for `UrlTransport` flows; prefer non-extractable `ECDSAKeyIdentity` for popup flows, where nothing needs serializing.

7. **Requesting an unscoped delegation.** Omitting `targets` asks for a delegation valid against *any* canister. Always pass the canisters you actually call.

8. **Diverging on a redirect replay.** With `UrlTransport`, issue the same requests and `memoize` steps in the same order on every load, and route anything a request depends on — a nonce above all — through `memoize`. Re-fetching a single-use value on the return load invalidates the flow.

9. **A `callbackUrl` that is relative, carries a fragment, or is not allow-listed.** It must be absolute, fragment-free (the transport appends its own), on an origin you control, and declared in that origin's `/.well-known/ii-auth-callbacks`.

10. **Top-level `await` in wallet code.** Every call here is async. Vite's default `es2020` target rejects top-level `await`; wrap calls in functions rather than raising `build.target`.

11. **`@icp-sdk/canisters@^3` with `@icp-sdk/signer@^6`.** They cannot coexist — canisters 3 peers `@icp-sdk/core@^5`, signer 6 peers `^6`, so `npm install` fails with `ERESOLVE`. Move to `@icp-sdk/canisters@^4` and `@dfinity/utils@^5`. Do not reach for `--legacy-peer-deps`: it skips the peer check and installs the mismatched pair anyway, so the incompatibility surfaces at runtime instead of at install time.

12. **Firing a call immediately after connecting.** Let the user initiate. An unprompted approval dialog straight after connect reads as an attack, and wallets are within their rights to reject it.

## Testing against a real wallet

There is no local signer to run: OISY is a hosted wallet, and a locally deployed frontend can talk to it because `localhost` is a secure context. Test on testnet tokens rather than mainnet value.

```bash
icp network start -d
icp deploy
```

Get free testnet tokens from the [ICP Faucet](https://faucet.internetcomputer.org) and switch OISY to the **IC (testnet tokens)** network to see them. Useful ledgers:

| Token | Ledger canister |
|-------|-----------------|
| TESTICP | `xafvr-biaaa-aaaai-aql5q-cai` |
| TICRC1 | `3jkp5-oyaaa-aaaaj-azwqa-cai` |

Set `host: 'https://icp-api.io'` on the agent even when serving from `localhost` — `host` is the API endpoint calls go to, not the origin your app is served from.

## Expected Behavior

- `getSupportedStandards()` resolves without a prompt and lists at least ICRC-25 and the transport's own standard.
- The first `getAccounts()` opens the wallet, the user approves, and it resolves with one or more `{ owner: Principal, subaccount?: Uint8Array }`.
- A ledger `transfer` through `SignerAgent` prompts once and resolves with a `bigint` block index.
- Cancelling any prompt rejects with `SignerError` and `code === 3001`.
- `requestDelegation` resolves with a `DelegationChain`, or throws if the wallet returned one broader or longer-lived than requested.
- After a reload, read-only state renders with no popup; the first write reopens one.

## Additional References

- **internet-identity** — II sign-in, delegation-based auth for your own app
- **agent-web-identity** — letting an agent or CLI act as the user in an II app
- **icp-cli** — `@icp-sdk/bindgen` actors to call your own canister through a `SignerAgent`
- **canister-security** — verifying `msg.caller` on the backend once calls arrive
- [OISY signer demo](https://github.com/dfinity/examples/tree/master/hosting/oisy-signer-demo) — a working relying party (React) built on `@icp-sdk/signer`
- [ICRC signer standards](https://github.com/dfinity/wg-identity-authentication) — the specifications behind every method above
