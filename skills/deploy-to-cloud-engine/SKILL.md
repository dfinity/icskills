---
name: deploy-to-cloud-engine
description: "Deploys a built Internet Computer project to a user's cloud engine (an OpenCloud engine): verify the icp CLI, link the console identity with `icp identity link web` (origin defaults to https://opencloud.org; a delegation handoff covers sandboxes whose 127.0.0.1 callback the browser cannot reach), run `icp deploy` against the engine's subnet, tag canisters with `__META_*` env vars for a named console app with labelled canisters and icon, and bake version metadata (service:git:sha, service:version) into the wasm. Also covers a funded proxy canister for cross-subnet cycle-bearing calls (exchange-rate, threshold ECDSA/Schnorr, vetKD). Use when shipping to a cloud engine; on mention of OpenCloud, an engine subnet id, or linking the icp CLI to an engine console; when sign-in never completes from a sandboxed agent; when naming, adding an icon, or recording the deployed version/git commit of a console app. Do NOT use for a general mainnet deploy with no engine or subnet (use icp-cli) or for writing canister logic."
license: Apache-2.0
compatibility: "icp-cli >= 0.3.0 (commands verified against 0.3.0 and 1.0.2; the delegation handoff needs `icp identity delegation`, present in 1.0.x), a cloud engine console account, a browser for the Internet Identity sign-in"
metadata:
  title: Deploy to Cloud Engine
  category: Infrastructure
---

# Deploy to Cloud Engine

## What This Is

A **cloud engine** is a user-owned slice of Internet Computer capacity, administered from a web console (by default `https://opencloud.org`). Each engine runs on a single **subnet**. This skill takes a project that already builds and gets it deployed onto that engine, from a coding agent.

This skill only covers the cloud-engine-specific steps: linking the CLI to the engine's console identity, and a subnet-targeted deploy. For everything else about the CLI (`icp.yaml`, recipes, environments, bindings, identities), load the **`icp-cli`** skill.

Before running any `icp` command you are unsure of, run `icp <subcommand> --help` (e.g. `icp identity link --help`, `icp deploy --help`) to confirm the command and flags exist. Do not infer flags. Authoritative reference: https://cli.internetcomputer.org/llms.txt

## What You Need

Two values. Look for them first in `icp.yaml` or earlier in the conversation. One has a default; the other you must ask for:

1. **Console origin** — the URL the user signs in to their cloud engine console with. **Defaults to `https://opencloud.org`** (the main OpenCloud console). It is used as the `--auth` origin in Step 1 so the linked CLI identity derives the **same principal that administers the engine**. Use the default, but say so and give the user a chance to override before linking:
   - Say: "I'll link the CLI against `https://opencloud.org`, the default console. If you sign in to your engine console at a different URL, tell me now."
   - Only use a different origin when the user names one — never substitute another URL on your own; the `--auth` origin determines the derived principal (see Pitfall 2).
2. **Subnet id** — the subnet the engine deploys to, required by `icp deploy --subnet`. There is **no default**; never guess it. The user finds it on the engine's **App Center / Applications** page in the console. If absent, **ask and do not proceed without it**:
   - Ask: "What is your engine's subnet id? It is shown on your engine's App Center / Applications page."

Record both so you do not re-ask within the session.

## Prerequisites

- `icp` on `$PATH` — see the **`icp-cli`** skill to install. Verify with `icp --version` (this skill's commands are verified against 0.3.0 and 1.0.2). If the installed version differs, confirm the flag set with `icp <cmd> --help` before running — flags have changed across major versions.
- A project that already builds. If it does not build or package yet, set that up first (see the `icp-cli` skill), then return here.
- macOS: `icp` stores its data under `~/Library/Application Support/org.dfinity.icp-cli/`. If the shell cannot write there (`Operation not permitted` from macOS TCC, e.g. when commands run through a bridge), redirect the data to an unprotected path for the session — `HOME=/tmp/icp-home icp …` — and keep that same `HOME` on **every** subsequent `icp` command, or the later commands will not see the linked identity.

## Step 1 — Link the CLI to your engine identity (once per machine)

The CLI must sign as the **same identity that administers the engine** — that is the principal you log in to the console with.

### Step 1.0 — First determine WHERE the CLI runs relative to the browser

`icp identity link web` completes the sign-in via a redirect to `http://127.0.0.1:<port>` **on the machine where the CLI runs**. The browser in which the user completes the Internet Identity sign-in must be able to reach that loopback address. Determine the environment before linking:

- **CLI and browser on the same machine, with network** (local development, or a terminal-integrated agent on the user's own machine) → use the normal link flow below.
- **CLI in a remote or isolated sandbox, with network** (the agent runs in the cloud; the user's browser is on a different machine) → the normal flow **cannot** work: the sign-in URL carries a `callback=http://127.0.0.1:<port>` bound to the sandbox, the user's browser resolves `127.0.0.1` to its *own* machine, and the delegation never reaches the CLI. Later commands then fail with authorization errors. Use the **delegation handoff** below instead.
- **CLI shell with no network at all** (e.g. a sandboxed device bridge on the user's own machine: DNS blocked, HTTPS requests fail, writes limited to `/tmp`) → **no** `icp` network command can run there — not the link, and not `icp deploy` either. The delegation handoff does not help: it only moves signing authority, not network access. Do not retry, tunnel, or proxy. Prepare the project and hand the user **one script** to run in their real terminal — see "No-network CLI host" below.

When in doubt, probe before linking: `curl -sI https://<console-origin>` failing (or DNS not resolving) from the CLI shell means the no-network case.

**Never** present a sandbox `127.0.0.1` URL to the user as something to open in their browser — it is unreachable from their machine. And do not invent a headless flag on `icp identity link web`: as of icp-cli 1.0.2 it has none (confirm with `icp identity link web --help`).

### Delegation handoff (CLI host and browser on different machines)

`icp identity delegation` transfers signing authority from an identity linked on the **user's** machine to a session key on the **CLI host**, without the browser ever reaching the CLI host. It requires `icp` installed on the user's machine too, and exists in icp-cli 1.0.x — verify with `icp identity delegation --help` on both machines. If the user's machine has `icp` and you can run commands there, the simplest path is to run this whole skill there instead; otherwise:

1. **On the CLI host (sandbox)** — create a pending identity with a fresh session key:

   ```bash
   icp identity delegation request <your-identity-name>
   ```

   It prints the session **public** key as a PEM to stdout. Give that PEM block to the user. (If the default `--storage keyring` fails in a headless sandbox, retry with `--storage plaintext`.)

2. **On the user's machine** — the user links there if not already linked (`icp identity link web <local-name> --auth <console-origin>` — the normal flow works locally), saves the PEM to a file, and signs a delegation to it:

   ```bash
   icp identity delegation sign --identity <local-name> --key-pem session-key.pem --duration 8h > delegation.json
   ```

   `--duration` takes e.g. `30m`, `8h`, `1d`; optionally `--canisters <ids>` restricts the delegation. The user sends `delegation.json` back. If `sign` fails with `delegation for identity <name> has expired or will expire within 5 minutes`, the local web session has lapsed — run `icp identity reauth <local-name>` (the normal browser flow, which works locally) and retry.

3. **On the CLI host** — complete the pending identity and activate it:

   ```bash
   icp identity delegation use <your-identity-name> --from-json delegation.json
   icp identity default <your-identity-name>
   icp identity principal   # must print the user's console principal
   ```

Treat `delegation.json` as a **time-limited credential**: whoever holds the sandbox's session key can sign as the user's console principal until it expires. Keep the duration short and re-run the handoff when it lapses.

### No-network CLI host — hand the user one script

If the CLI shell cannot reach the network, the user's real terminal is the deploy machine — and because their terminal and browser share a loopback there, the **normal** link flow works; no delegation handoff is needed. Your job shifts to preparation:

1. Get the built project into a directory the user's terminal can reach.
2. Write one script at the project root that does the whole network-bound sequence — adapt this template (fill in the real identity name, console origin, and subnet id; do not leave placeholders):

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   icp --version
   icp identity list | grep -E '^\*? *<your-identity-name> ' >/dev/null || icp identity link web <your-identity-name> --auth <console-origin>
   icp identity default <your-identity-name>
   icp deploy -e ic --subnet <subnet-id>
   ```

3. Ask the user to run it in their terminal, complete the Internet Identity sign-in when the browser opens, and paste the output back.
4. Verify from the pasted output (canister ids, frontend URL) and continue — a re-deploy for the Step 2 `__META_*` variables goes through the same script.

### Normal link flow (CLI and browser share a loopback)

First check what already exists:

```bash
icp identity list      # names + principals; * marks the active identity
```

The list does **not** show which console (if any) an identity was linked against — that cannot be determined from the CLI. Decide like this:

- **Only `anonymous` (or plain local identities) listed** — no web-linked identity exists; run the link command below.
- **An identity the user recognizes as their engine identity** (by name or principal) — set it active (below) and skip to Step 2.
- **Unsure** — ask the user, or simply relink under a new name; linking again is cheap and safe.

To link, run this, substituting a name the user picks — `<your-identity-name>` is any local label, not a fixed value (do not hardcode something like `my-engine-admin`); reuse the **same** name in every command below:

```bash
icp identity link web <your-identity-name> --auth <console-origin>
```

- Use `https://opencloud.org` as `<console-origin>` unless the user named a different console. Never omit `--auth`: the flag has a built-in default (`https://id.ai`) that is **not** your console and silently derives the wrong principal.
- The command first waits at a **"Press Enter to log in"** prompt before anything happens. Run it interactively when you can; in a non-interactive shell (e.g. a background process) pipe a real newline:

  ```bash
  printf '\n' | icp identity link web <your-identity-name> --auth <console-origin>
  ```

  Do **not** redirect stdin from `/dev/null` — the bare EOF does not satisfy the prompt, and the command sits on "Press Enter to log in" indefinitely with no browser ever opening.
- After Enter it opens a **browser tab**. The **user** completes the Internet Identity sign-in there. Wait for them to confirm before continuing — you cannot complete the sign-in for them.
- `--auth` must be the **exact** console origin (scheme + host), e.g. `https://opencloud.org`. A mismatched origin derives a *different* principal, and the engine will reject the deploy as unauthorized.
- This is a **one-time, per-machine** step.

Then make it the active identity and verify:

```bash
icp identity default <your-identity-name>
icp identity default     # prints the active identity name
icp identity principal   # prints the principal the deploy will sign as
```

## Step 2 — Name the app (and give it an icon) in the console (recommended)

By default, CLI-deployed canisters appear on the engine console's Applications page as bare rows labelled only by their principal id. A set of **canister environment variables** makes the console group them into a single named application with readable per-canister labels, an "Open" button, and an icon. Set them once in your project config:

- `__META_PROJECT` — the application name. Canisters that share the **same** value are grouped into one named app, so set an identical value on every canister of the app.
- `__META_NAME` — the per-canister display label (e.g. `Backend`, `Frontend`).
- `__META_MAIN_CANISTER` — the literal string `"true"` on exactly one canister (the entry point, usually the frontend/asset canister). This marks the app's **main canister**: the console reads `__META_BASE_URL` and `__META_ICON_PATH` only from it, and the "Open" button targets it.
- `__META_BASE_URL` — an **absolute `https://` URL**, set on the main canister (e.g. the frontend canister's URL `https://<frontend-canister-id>.icp.net`, or a custom domain). When present and valid, it is the URL the "Open" button opens; when absent or not `https`, the "Open" button falls back to the main canister's gateway URL. It is also the base that `__META_ICON_PATH` resolves against.
- `__META_ICON_PATH` — the path to the app icon, resolved against `__META_BASE_URL` to form the icon the console renders (e.g. `/favicon.svg` → `https://<base>/favicon.svg`). Set it on the **main** canister, alongside `__META_BASE_URL`.

The icon and "Open" link are read **only from the main canister** (the one marked `__META_MAIN_CANISTER: "true"`) — `__META_BASE_URL` / `__META_ICON_PATH` on any other canister are ignored.

Set them under each canister's `settings.environment_variables` — this is valid alongside a recipe. With per-canister `canister.yaml` files:

```yaml
# frontend/canister.yaml
name: frontend
recipe:
  type: "@dfinity/asset-canister@v2.2.1"
  configuration:
    build:
      - npm install
      - npm run build
    dir: dist
settings:
  environment_variables:
    __META_PROJECT: "My App"
    __META_NAME: "Frontend"
    __META_MAIN_CANISTER: "true"
    __META_BASE_URL: "https://<frontend-canister-id>.icp.net"
    __META_ICON_PATH: "/favicon.svg"
```

```yaml
# backend/canister.yaml
name: backend
recipe:
  type: "@dfinity/motoko@v5.0.0"   # v5 reads main/candid from mops.toml ([canisters.backend]) — see the icp-cli skill
settings:
  environment_variables:
    __META_PROJECT: "My App"
    __META_NAME: "Backend"
```

For a single inline `icp.yaml` (canisters defined there directly), put the same `settings.environment_variables` block under each canister entry. Note the inline form: `canisters` is an **array** of `{name, recipe, settings}` items, not a map keyed by canister name:

```yaml
# icp.yaml — canisters defined inline
canisters:
  - name: frontend
    recipe: # … as in the canister.yaml example above
    settings:
      environment_variables:
        __META_PROJECT: "My App"
        __META_NAME: "Frontend"
        __META_MAIN_CANISTER: "true"
        __META_BASE_URL: "https://<frontend-canister-id>.icp.net"
        __META_ICON_PATH: "/favicon.svg"
  - name: backend
    recipe: # … as in the canister.yaml example above
    settings:
      environment_variables:
        __META_PROJECT: "My App"
        __META_NAME: "Backend"
```

Notes:
- icp-cli **merges** these with the `PUBLIC_CANISTER_ID:<name>` variables it injects automatically at deploy time — the asset canister keeps serving and the app keeps working. (Verified against icp-cli 0.3.0.)
- All values are strings; `__META_MAIN_CANISTER` must be the exact string `"true"`.
- They are applied during `icp deploy` (the "Setting environment variables" step). After deploy, confirm with `icp canister settings show <name> -e ic`.

Icon specifics (the console builds the icon as `__META_BASE_URL` + `__META_ICON_PATH`):
- **Both** must be present and **on the main canister** for an icon to appear — there is no fallback. `__META_ICON_PATH` alone does nothing.
- `__META_BASE_URL` must parse as an absolute **`https://`** URL. A bare host, an `http://` URL, or a `data:` / `javascript:` value is rejected: the icon then does not render, and the "Open" button falls back to the main canister's gateway URL (it does not disappear). (The console validates the scheme before using it.)
- `__META_ICON_PATH` is a **path to an asset your frontend actually serves** (e.g. `/favicon.svg`), not an inline image. The resolved URL is rendered as an `<img>` `src`, so it must return an image. Do **not** put a `data:` URI here: engine env values are length-capped (≤128 chars observed), so it would not fit, and the field is a path by design.
- The frontend canister's id is only known **after** the first deploy. The usual flow is: deploy once, read the frontend canister id from the output, set `__META_BASE_URL` to `https://<that-id>.icp.net` (and `__META_ICON_PATH`), then re-deploy to apply. If you control a custom domain for the app, you can set it up front instead.

### Version metadata (recommended)

Embed build provenance into each canister's wasm so tooling and the console can show what version is running (console support is rolling out; the metadata is already readable — see the verify note below). Add this **by default on every deploy** — do not wait for the user to ask. All official recipes (motoko, rust, asset-canister, prebuilt) accept a `metadata` list under the recipe `configuration`; each entry is baked into the wasm as a custom section. Values are interpolated into a shell command at build time, so `$(…)` command substitution works. (Verified by live builds against `@dfinity/motoko` v4.1.0 and v5.0.0 on icp-cli 1.0.2.)

**Git project** (check first: `git rev-parse HEAD` succeeds):

```yaml
recipe:
  type: "@dfinity/motoko@v5.0.0"
  configuration:
    metadata:
      - name: service:git:sha
        value: $(git rev-parse HEAD)$(git diff --quiet HEAD 2>/dev/null || echo +dirty)
      - name: service:git:origin
        value: $(git remote get-url origin)
      - name: service:git:updated_at
        value: $(git log -1 --format=%cI)
      - name: service:version
        value: $(node -p "require('./package.json').version" 2>/dev/null || echo 1.0.0)
```

**Non-git project** — the git substitutions above do **not** fail the build; they silently bake garbage (`service:git:sha` becomes the literal `+dirty`, `service:git:origin` comes out empty). Use only an explicit version, and bump it on each subsequent deploy:

```yaml
metadata:
  - name: service:version
    value: "1.0.0"
```

Notes:

- Use these exact names (`service:git:sha`, `service:git:origin`, `service:git:updated_at`, `service:version`) — they are the agreed convention the console will read; differently named entries will not be picked up.
- Prefer command results over literals where possible: `+dirty` on the sha flags uncommitted changes, so a deploy is traceable to its exact source state.
- Values must be **deterministic** for a given source tree: sha, origin, the last commit's date, a version string. Never embed a build time (`$(date)`) or other build-time-varying values. The commit date (`%cI`) is allowed because it is a property of the commit, not of the build — but note it means "code last changed", not "last deployed": deploying an old commit shows the old date. The deploy time itself comes from the canister history the network records automatically.
- If the project has no `package.json` (or no version field), the fallback `1.0.0` applies; replace it with the project's real versioning scheme when one exists.
- The sections are injected as `icp:private`, readable by the canister's controllers (you, and the console acting as you) via read_state — no canister call needed. Verify after deploy, with the linked identity active: `icp canister metadata <canister-name> service:git:sha -e ic`.

## Step 3 — Deploy to the engine's subnet

From the project root:

```bash
icp deploy -e ic --subnet <subnet-id>
```

- `-e ic` targets mainnet (the engine runs on an IC subnet); `--subnet <subnet-id>` pins the deploy to **your engine's** subnet. Confirm the exact flags with `icp deploy --help` before running if unsure.
- Deploying consumes capacity on the engine; make sure the engine has room.

**Alternative — packaged upload.** If the project is distributed as a built `.icp` package and a direct `icp deploy` is not available, upload the bundle on the console's App Center via **"Upload a custom app"** instead.

## Step 4 — Verify

- The `icp deploy` output reports the deployed canister ids.
- The canisters appear on the engine's **Applications** page in the console; each canister's detail view offers an "Open in browser" link.
- If you set the metadata in Step 2, the canisters are grouped under your `__META_PROJECT` name with their `__META_NAME` labels, and the main canister shows an "Open" button — instead of bare principal rows. With `__META_BASE_URL` + `__META_ICON_PATH` set, the app also shows its icon (allow for a short console cache delay).
- A frontend (asset) canister is served at `https://<frontend-canister-id>.icp.net`.

Report the deployed canister ids (and the frontend URL, if any) back to the user.

## Cross-subnet calls via a proxy canister (only if the app needs them)

A cloud engine runs on a **`CloudEngine` subnet**, which the IC protocol restricts: a canister on it **cannot** send a cross-subnet (XNet) message that carries **attached cycles** or that is a **guaranteed-response (unbounded-wait)** call. So an engine canister **cannot call these directly**, because they live on other subnets and require cycles:

- the **exchange-rate canister** (XRC),
- **threshold ECDSA / Schnorr** signing (`sign_with_ecdsa`, `sign_with_schnorr`) and their public-key methods,
- **vetKD** (`vetkd_derive_key`, `vetkd_public_key`),
- any other canister you must call **with cycles** across a subnet boundary.

The workaround is a **proxy canister**: deployed on a normal Application subnet and funded with cycles. Your engine canister makes a cheap, cycle-less, bounded-wait call to the proxy, which re-issues it locally **with the cycles attached** and relays the raw reply back. Same-subnet or cycle-less calls do **not** need it.

### Deploy and fund the proxy (from the console, not the CLI)

1. Open the engine console → **Applications** (App Center) → **Proxy canisters**.
2. **Deploy a proxy**, choose an initial balance (minimum $5), and optionally enable **automatic top-up** to recharge from the saved card when it runs low. You can top up manually or delete the proxy later from the same table.
3. Copy the **proxy canister id** shown in the table — the app calls this id.

The proxy authorizes callers whose principal falls in **the engine's canister-id range**, so every canister deployed to the engine may use it with no extra configuration.

### Call through the proxy from your canister

Instead of calling the target canister directly, call the proxy's `proxy` method with the target id, method name, candid-encoded argument bytes, and the cycles to attach. Its candid interface:

```candid
type ProxyArgs = record { canister_id : principal; method : text; args : blob; cycles : nat };
type ProxySucceed = record { result : blob };
type ProxyError = variant {
  InsufficientCycles : record { available : nat; required : nat };
  CallFailed : record { reason : text };
  UnauthorizedUser;
};
type ProxyResult = variant { Ok : ProxySucceed; Err : ProxyError };
service : {
  proxy : (ProxyArgs) -> (ProxyResult);
  get_allowed_ranges : () -> (vec record { start : principal; end : principal }) query;
};
```

- `args` is the **candid-encoded argument of the _target_ method** (you encode it); `result` is the target's **raw reply bytes** (you decode it).
- `cycles` is what the proxy attaches to the relayed call — size it to what the target charges (e.g. the XRC or signing fee). Do **not** attach cycles to the outer `proxy` call itself; the engine subnet forbids that and it is unnecessary.
- Handle `ProxyError`: `InsufficientCycles` means the proxy's balance is too low (top it up in the console), `UnauthorizedUser` means the caller is outside the engine's range, `CallFailed` carries the downstream reject reason.

Motoko sketch (Rust is analogous with `candid::encode_one` / `decode_one`):

```motoko
// `proxy` is an actor typed to the candid interface above.
let arg = to_candid (request);                    // encode the TARGET method's argument
let res = await proxy.proxy({
  canister_id = xrcPrincipal;
  method = "get_exchange_rate";
  args = arg;
  cycles = 1_000_000_000;                         // the XRC fee the proxy forwards
});
switch (res) {
  case (#Ok { result }) { let ?reply = from_candid (result) else return; /* … */ };
  case (#Err e) { /* InsufficientCycles | CallFailed | UnauthorizedUser */ };
};
```

### Threshold keys through the proxy (read this before deriving keys)

For the management-canister key methods (`sign_with_ecdsa`, `ecdsa_public_key`, `sign_with_schnorr`, `schnorr_public_key`, `vetkd_derive_key`, `vetkd_public_key`), the proxy **isolates the derivation per calling canister**: it prefixes the caller's (unforgeable) principal into the `derivation_path` (ECDSA/Schnorr) or `context` (vetKD), and forces `canister_id = None` on the `*_public_key` calls. Two consequences:

- Each engine canister behind the proxy gets its **own** key namespace — one canister cannot read or sign with another's key.
- The key/address obtained **through the proxy differs** from what a direct management-canister call would give (the injected prefix changes the derivation). Always fetch the public key and sign **through the same proxy**, consistently, so the address you derive matches the key you can sign for. Do not mix direct and proxied key calls for one identity.

## Common Pitfalls

1. **Sign-in not completed.** Running `icp identity link web …` but not finishing the Internet Identity sign-in in the browser leaves the CLI unlinked; later commands fail with authorization errors. Re-run and wait for the user to confirm the browser flow finished. If no browser ever opened, the command is stalled at the "Press Enter to log in" prompt — relaunch with a piped newline, `printf '\n' | icp identity link web …`, never `< /dev/null` (see Step 1). If the CLI runs in a remote sandbox, re-running can never complete — see Pitfall 14 and the delegation handoff in Step 1.0.
2. **Wrong `--auth` origin.** Using any URL other than the console origin the user signs in with derives a different principal, and the engine rejects the deploy as not authorized. Relink with the exact console URL. If the deploy is rejected as unauthorized after linking against the default `https://opencloud.org`, ask the user for the exact URL they sign in with and relink.
3. **Guessing the subnet id.** Never invent it — the deploy fails or targets the wrong subnet. It is on the engine's App Center / Applications page; ask the user.
4. **Deploying with the anonymous identity.** The default local identity is anonymous and is not the engine admin. You must link and `icp identity default <your-identity-name>` first.
5. **Using `dfx`.** This ecosystem uses `icp`, never `dfx`. The correct sequence is `icp identity link web <name> --auth <console-origin>` (Step 1), then `icp deploy -e ic --subnet <subnet-id>` (Step 3). See the `icp-cli` skill.
6. **Skipping the app metadata.** Without `__META_PROJECT` (Step 2), the canisters still deploy and work but render as bare, unnamed principal rows in the console. Setting `__META_*` is what produces a named app with labelled canisters and an "Open" button.
7. **Wrong `__META_MAIN_CANISTER` value.** It is matched as the exact string `"true"`. A boolean, `"True"`, or marking more than one canister means no (or the wrong) "Open" button. Mark exactly one entry-point canister.
8. **Inventing an icon variable.** The icon variable is `__META_ICON_PATH` (a path resolved against `__META_BASE_URL`). Do not guess `__META_ICON`, `__META_LOGO`, or `__META_ICON_LINK` — they are ignored, so the icon silently never appears.
9. **Icon set on the wrong canister, or without a base URL.** The icon is read only from the **main** canister and needs **both** `__META_BASE_URL` (a valid absolute `https://` URL) and `__META_ICON_PATH`. Setting the icon path on a side canister, omitting the base URL, or giving a non-https / `data:` base means no icon renders. (The "Open" button still works — it falls back to the main canister's gateway URL — so a bad base URL costs the icon and the custom Open URL, not the button.)
10. **Calling the XRC / threshold signing / vetKD directly from an engine canister.** These are cross-subnet, cycle-bearing calls, which a `CloudEngine`-subnet canister cannot make — the call is rejected. Route them through a funded proxy canister (see "Cross-subnet calls via a proxy canister"). Plain same-subnet or cycle-less calls do not need the proxy.
11. **Attaching cycles to the outer `proxy` call.** The engine subnet forbids cycle-bearing cross-subnet messages — that is the whole reason for the proxy. Put the cycles inside `ProxyArgs.cycles` (the proxy attaches them locally); never `with_cycles` on the call to `proxy` itself.
12. **Proxy out of cycles, or funded from the CLI.** A `ProxyError::InsufficientCycles` means the proxy's balance is spent — top it up (or enable auto top-up) on the console's Proxy canisters page. Deploying and funding the proxy is a console action, not an `icp` command.
13. **Expecting a direct-call key through the proxy.** Threshold-key derivation via the proxy is caller-isolated, so the derived key/address is not the same as a direct management-canister call. Fetch the public key and sign through the proxy consistently; do not mix direct and proxied key calls for the same identity.
14. **Assuming the browser and CLI share localhost.** `icp identity link web` returns the delegation to `127.0.0.1:<port>` on the CLI host. If the CLI runs in a remote sandbox while the user's browser is on a different machine, the sign-in never completes and later commands fail with authorization errors — no amount of re-running the link fixes it. See Step 1.0: use the delegation handoff (`icp identity delegation request` / `sign` / `use`), or run the link and deploy where the browser and CLI share a loopback.
15. **Expecting the delegation handoff to fix a missing network.** The handoff moves signing authority, not connectivity — `icp deploy` still needs the network from the shell that runs it. If the CLI shell has no network at all (a sandboxed device bridge: DNS blocked, HTTPS fails), no `icp` network command can run there, link or deploy. Do not offer to "do the rest" from that shell and do not tunnel — hand the user one script for their real terminal (see "No-network CLI host" in Step 1.0), where the normal link flow works because terminal and browser share a loopback.
16. **Build timestamps in wasm metadata.** Metadata is baked into the wasm and must be deterministic — a build time (`$(date)`) changes every build even with identical source, breaking reproducibility and changing the module hash on every deploy. The deterministic alternative is the last commit's date, `service:git:updated_at` = `$(git log -1 --format=%cI)` — a property of the source tree, not the build. The deploy time itself comes from the canister history recorded by the network, never from metadata.
17. **Git metadata substitutions in a non-git project.** Outside a git repository, `$(git rev-parse HEAD)` does not fail the build — it silently bakes garbage: `service:git:sha` becomes the literal `+dirty` and `service:git:origin` comes out empty. Check for a git repo first (`git rev-parse HEAD` succeeds); if there is none, set only `service:version` with an explicit value (or `git init` and commit before deploying, if version control is wanted anyway).

## Related Skills

If a referenced skill is not already available, install it the same way this one was installed — `npx skills add dfinity/icskills --skill <name>` — or read it at `https://skills.internetcomputer.org/skills/<name>/`.

- **icp-cli** — general icp CLI usage (`icp.yaml`, recipes, environments, bindings, identities). Load it for anything beyond this cloud-engine deploy flow — in particular when the project does not build or package yet.
- **internet-identity** — details of the Internet Identity sign-in that Step 1 triggers in the browser.
