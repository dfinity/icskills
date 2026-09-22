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

The transport is the only part that knows *how* the wallet is reached; the `Signer` API above it is identical whichever you choose.

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
import { Signer } from '@icp-sdk/signer';
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
import { DelegationIdentity, ECDSAKeyIdentity, Ed25519KeyIdentity } from '@icp-sdk/core/identity';
import type { Principal } from '@icp-sdk/core/principal';
import { Signer } from '@icp-sdk/signer';
import { UrlTransport } from '@icp-sdk/signer/web';

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
import { Signer } from '@icp-sdk/signer';

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

Most signers start every scope at `ask_on_use`, prompting the first time each method is used — but ICRC-25 leaves the initial state to signer policy, so `getPermissions()` is the only authority. `requestPermissions` is **optional**: it trades several later prompts for one up front.

| State | Behaviour |
|-------|-----------|
| `granted` | Proceeds without prompting |
| `denied` | Rejected immediately with error `3000` |
| `ask_on_use` | Prompts on first use (the default) |

```typescript
import type { IcrcAccount } from '@icp-sdk/canisters/ledger/icrc';
import { Principal } from '@icp-sdk/core/principal';
import type { PermissionScope, Signer } from '@icp-sdk/signer';

// Path A: [{ method: 'icrc27_accounts' }, { method: 'icrc49_call_canister' }]
// Path B: [{ method: 'icrc27_accounts' }, { method: 'icrc34_delegation' }]
async function connect(signer: Signer, scopes?: PermissionScope[]) {
  // Omit `scopes` to leave every method on ask_on_use. Supply them to trade
  // several later prompts for one up front. Ask only for what your path uses:
  // a scope the signer does not support is dropped before the prompt is drawn,
  // so it costs nothing, but a supported one you never exercise is shown to
  // the user for no reason.
  if (scopes !== undefined) {
    await signer.requestPermissions(scopes);
  }

  const accounts = await signer.getAccounts();
  // { owner: Principal, subaccount?: Uint8Array } — already an IcrcAccount.
  // Usually there is no subaccount: signers commonly offer only the default
  // one. Return the element whole anyway — it costs nothing, and a signer
  // that does offer subaccounts breaks code that assumed otherwise.
  return accounts[0];
}
```

`getPermissions()` reads the current state without prompting. Do not cache it across sessions — a wallet may expire grants, after which they silently revert to `ask_on_use`.

## Path A — per-action approval

`SignerAgent` implements `Agent`, so it drops into anything that takes one: a ledger client from `@icp-sdk/canisters`, or an actor from `@icp-sdk/bindgen` for your own canister. Each call becomes a wallet prompt.

```typescript
import { IcrcLedgerCanister, toCandidAccount, type IcrcAccount } from '@icp-sdk/canisters/ledger/icrc';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Principal } from '@icp-sdk/core/principal';
import { Signer } from '@icp-sdk/signer';
import { SignerAgent } from '@icp-sdk/signer/agent';

const ICP_LEDGER = Principal.fromText('ryjl3-tyaaa-aaaaa-aaaba-cai');

// Two clients against the same ledger: one for reads, one for writes.
async function connectLedger(signer: Signer, account: IcrcAccount) {
  // One HttpAgent serves both. It answers reads directly, and SignerAgent
  // borrows it for the root key and status instead of building its own.
  const agent = await HttpAgent.create({ host: 'https://icp-api.io' });
  // SignerAgent routes calls as a principal; it has no subaccount field.
  const signerAgent = await SignerAgent.create({ signer, account: account.owner, agent });

  return {
    read: IcrcLedgerCanister.create({ agent, canisterId: ICP_LEDGER }),
    write: IcrcLedgerCanister.create({ agent: signerAgent, canisterId: ICP_LEDGER }),
    signerAgent
  };
}
```

**Read with the plain agent, write with the signer agent.** `SignerAgent.query()` upgrades every query into a full canister call routed through the wallet, so a balance check would become a user prompt and cost cycles:

```typescript
import { type IcrcAccount, toCandidAccount } from '@icp-sdk/canisters/ledger/icrc';
import { Signer } from '@icp-sdk/signer';

async function showBalanceThenTransfer(
  signer: Signer, account: IcrcAccount, to: IcrcAccount, amount: bigint
) {
  const { read, write } = await connectLedger(signer, account);

  // balance() takes an IcrcAccount directly.
  const balance = await read.balance(account);                            // silent

  const block = await write.transfer({                                    // prompts
    // The ledger's `to` is the Candid shape; convert rather than hand-roll it.
    to: toCandidAccount(to),
    // The subaccount the tokens leave from.
    from_subaccount: account.subaccount,
    amount
  });

  return { balance, block };
}
```

`signerAgent.replaceAccount(principal)` switches which principal later writes are signed for, without rebuilding the agent.

## Path B — session delegation

The wallet delegates to a key your app generates. Afterwards you hold an ordinary `HttpAgent` and the wallet is not involved again until the delegation expires.

```typescript
import { HttpAgent } from '@icp-sdk/core/agent';
import { DelegationIdentity, ECDSAKeyIdentity } from '@icp-sdk/core/identity';
import { Principal } from '@icp-sdk/core/principal';
import { Signer } from '@icp-sdk/signer';

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
import { Signer } from '@icp-sdk/signer';

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

**A connection does not survive a page reload.** There is no persistent session to restore — the channel is a live `postMessage` link to a popup that is gone. The workable pattern is to persist the account, render read-only state from it with an anonymous agent, and re-establish the signer lazily on the first write:

```typescript
import { type IcrcAccount, decodeIcrcAccount, encodeIcrcAccount } from '@icp-sdk/canisters/ledger/icrc';
import { HttpAgent } from '@icp-sdk/core/agent';
import { Signer } from '@icp-sdk/signer';
import { SignerAgent } from '@icp-sdk/signer/agent';

const SESSION_KEY = 'wallet-account';

// On connect: remember the account, not the channel. The ICRC-1 textual
// encoding round-trips owner and subaccount as one string, so the
// subaccount survives the reload too (see pitfall 12).
function rememberAccount(account: IcrcAccount) {
  sessionStorage.setItem(SESSION_KEY, encodeIcrcAccount(account));
}

// On reload: read-only state renders from this immediately, with no popup.
function restoreAccount(): IcrcAccount | null {
  const stored = sessionStorage.getItem(SESSION_KEY);
  if (stored === null) return null;
  try {
    return decodeIcrcAccount(stored);
  } catch {
    sessionStorage.removeItem(SESSION_KEY);  // stale or malformed
    return null;
  }
}

// On the first write after a reload. This reopens the popup, so it must run
// from the click that starts that write — pitfall 1 applies here too.
async function ensureSignerAgent(signer: Signer, account: IcrcAccount, agent: HttpAgent) {
  const offered = await signer.getAccounts();  // re-establishes the channel
  // The user may have switched accounts while the page was gone, so the stored
  // one is a guess until the wallet confirms it. Compare encodings, not owners:
  // the same principal with a different subaccount is a different account.
  const id = encodeIcrcAccount(account);
  if (!offered.some((offer) => encodeIcrcAccount(offer) === id)) {
    sessionStorage.removeItem(SESSION_KEY);
    throw new Error('the wallet no longer offers the stored account; reconnect');
  }
  return SignerAgent.create({ signer, account: account.owner, agent });
}
```

Treat "disconnect" as clearing your own state — there is no wallet-side logout to call.

## Error handling

```typescript
import { Signer, SignerError } from '@icp-sdk/signer';
import { PostMessageTransportError } from '@icp-sdk/signer/web';
import { Principal } from '@icp-sdk/core/principal';
import type { IcrcAccount } from '@icp-sdk/canisters/ledger/icrc';

async function safeTransfer(
  signer: Signer, account: IcrcAccount, to: IcrcAccount, amount: bigint
) {
  try {
    await showBalanceThenTransfer(signer, account, to, amount);
  } catch (err) {
    if (err instanceof SignerError) {
      switch (err.code) {
        case 3001: return;                       // user cancelled — not a failure
        case 3000: showPermissionHelp(); return; // permission denied
        case 2000: showUnsupported(); return;    // wallet does not support the method
        case 4000:                               // every transport failure lands here
        case 4001:                               // only if the signer itself returns it
          // The transport error is the `cause`, never the error you caught.
          if (err.cause instanceof PostMessageTransportError) showPopupBlockedHelp();
          else promptReconnect();
          return;
        default: throw err;
      }
    }
    // Anything else — including SignerAgentError, where the wallet responded
    // but the response failed validation — is not a connectivity fault.
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
| `4000` | Network error | Reconnecting — the library also reports every transport failure here |
| `4001` | Transport channel closed | Reconnecting (signer-reported only; see below) |

Two failures do not arrive as the class you would expect, and they call for opposite reactions:

- **Transport failures arrive as `SignerError` with code `4000`.** `Signer.openChannel()` catches whatever the transport threw — `PostMessageTransportError`, `UrlTransportError`, `BrowserExtensionTransportError` — and rethrows it as a `SignerError` with the original as `cause`. So a blocked popup is *not* `instanceof PostMessageTransportError`; test `err.cause` for that. The library also never emits `4001`: "channel closed before a response" is `4000` too, and `4001` reaches you only if the signer itself returns it.
- **`SignerAgentError`** — the wallet *did* respond, and the response failed validation: the returned content map did not match the call you sent (canister, method, argument, sender, nonce), the certificate did not verify against the IC root key, or the reply was absent from the certified tree. `SignerAgent` runs those checks for you, so this is a wallet returning something it should not have. Do not treat it as a connectivity fault and retry — surface it.

## Pitfalls

1. **Opening the popup outside a click handler.** `PostMessageTransport` rejects establishment that is not user-initiated (`detectNonClickEstablishment`, default `true`) because Safari and others block such popups. Connect from an event handler, never on mount or in a `useEffect`.

   ```typescript
   // WRONG — blocked, and the transport detects it
   useEffect(() => { signer.getAccounts(); }, []);

   // CORRECT
   button.addEventListener('click', () => signer.getAccounts());
   ```

2. **Reading through `SignerAgent`.** `query()` is upgraded to an update call routed through the wallet, so every read prompts the user and costs cycles. Reads go through a plain `HttpAgent`; only writes go through `SignerAgent`.

3. **Expecting a connection to survive a reload.** No channel outlives the page. Persist the account — both halves, per pitfall 12 — for read-only rendering, and reconnect on first write. See above.

4. **Assuming a wallet's capabilities.** Call `getSupportedStandards()`. A wallet that executes canister calls (ICRC-49) may not issue delegations (ICRC-34), and vice versa.

5. **Coding against one wallet's non-standard error codes.** Only `1000`/`2000`/`3000`/`3001`/`4000`/`4001` are ICRC-25. Vendor extensions outside that range are not portable — earlier revisions of this skill documented a `503 BUSY` code that exists only in `@dfinity/oisy-wallet-signer` and in no standard. Branch on the standard codes and treat the rest as generic.

6. **Journaling a non-serializable session key through `memoize()`.** `memoize` persists via JSON, so `ECDSAKeyIdentity` cannot cross a redirect — its `getKeyPair()` returns `CryptoKey`s that `JSON.stringify` silently reduces to `{}`, and the flow fails on return with a key it cannot sign with. Use `Ed25519KeyIdentity` (`toJSON`/`fromJSON`) for `UrlTransport` flows; prefer non-extractable `ECDSAKeyIdentity` for popup flows, where nothing needs serializing.

7. **Requesting an unscoped delegation.** Omitting `targets` asks for a delegation valid against *any* canister. Always pass the canisters you actually call.

8. **Diverging on a redirect replay.** With `UrlTransport`, issue the same requests and `memoize` steps in the same order on every load, and route anything a request depends on — a nonce above all — through `memoize`. Re-fetching a single-use value on the return load invalidates the flow.

9. **A `callbackUrl` that is relative, carries a fragment, or is not allow-listed.** It must be absolute, fragment-free (the transport appends its own), on an origin you control, and declared in that origin's `/.well-known/ii-auth-callbacks`.

10. **Top-level `await` in wallet code.** Every call here is async, and a module-load `await` fires a wallet request outside a user gesture — pitfall 1. Wrap calls in functions the UI invokes. Do not rely on the build to catch it: Vite ≤5 defaulted to `es2020` and rejected top-level `await` outright, while Vite 6+ defaults to `baseline-widely-available` and allows it.

11. **`@icp-sdk/canisters@^3` with `@icp-sdk/signer@^6`.** They cannot coexist — canisters 3 peers `@icp-sdk/core@^5` or older, signer 6 peers `^6`, so `npm install` fails with `ERESOLVE`. Move to `@icp-sdk/canisters@^4` and `@dfinity/utils@^5`. Do not reach for `--legacy-peer-deps`: it skips the peer check and installs the mismatched pair anyway, so the incompatibility surfaces at runtime instead of at install time.

12. **Treating an account as just a principal.** `getAccounts()` returns `{ owner, subaccount? }` — an `IcrcAccount`. The subaccount is usually absent, because signers commonly offer only the default one, so code that assumes a bare principal works until it meets a signer that does not. Carry the account whole and let the library helpers do the rest: **compare** with `encodeIcrcAccount()` and never `owner` alone (that encoding normalizes the default subaccount, so the same principal with a *different* one is correctly a different account), **persist** with `encodeIcrcAccount()` / `decodeIcrcAccount()`, and **send** with `from_subaccount` for the sender plus `toCandidAccount()` for the recipient. `SignerAgent` is the exception — its `account` is a `Principal`, which is why the subaccount travels in the ledger call arguments instead.

13. **Firing a call immediately after connecting.** Let the user initiate. An unprompted approval dialog straight after connect reads as an attack, and wallets are within their rights to reject it.

## Testing against a real wallet

There is no local signer to run: OISY is hosted, and the transport's secure-context requirement applies to the *signer's* URL, not to your origin — `https://oisy.com/sign` satisfies it. Serving your own frontend from `localhost` is fine, and it is a browser secure context, so WebCrypto key generation works there too. Test on testnet tokens rather than mainnet value.

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

- The first `getAccounts()` opens the wallet, the user approves, and it resolves with one or more `{ owner: Principal, subaccount?: Uint8Array }`.
- A ledger `transfer` through `SignerAgent` prompts once and resolves with a `bigint` block index.
- Cancelling any prompt rejects with `SignerError` and `code === 3001`.
- After a reload, read-only state renders with no popup; the first write reopens one.

## Additional References

- **internet-identity** — II sign-in, delegation-based auth for your own app
- **agent-web-identity** — letting an agent or CLI act as the user in an II app
- **icp-cli** — `@icp-sdk/bindgen` actors to call your own canister through a `SignerAgent`
- **canister-security** — verifying `msg.caller` on the backend once calls arrive
- [OISY signer demo](https://github.com/dfinity/examples/tree/master/hosting/oisy-signer-demo) — a working relying party (React) built on `@icp-sdk/signer`
- [ICRC signer standards](https://github.com/dfinity/wg-identity-authentication) — the specifications behind every method above
