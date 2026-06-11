---
name: deploy-to-cloud-engine
description: "Deploys an already-built Internet Computer project to a user's own cloud engine (an OpenCloud / control-panel engine, administered from a web console). Covers verifying the icp CLI, linking the user's console identity to the CLI with `icp identity link web`, defaulting the console origin to https://opencloud.org (overridable when the user signs in to a different console), obtaining the engine's subnet id (asking the user when it is unknown), running `icp deploy` against that subnet, and tagging the canisters with `__META_*` environment variables so the engine console shows a named app with labelled backend/frontend canisters. Use when a developer wants to ship an app to their cloud engine, mentions a cloud engine, OpenCloud, an engine subnet id, linking the icp CLI to an engine console, or giving a deployed app a name in the console. Do NOT use for a general mainnet deploy with no specific engine or subnet (use the icp-cli skill) or for writing canister code."
license: Apache-2.0
compatibility: "icp-cli >= 0.3.0 (commands verified against 0.3.0), a cloud engine console account, a browser for the Internet Identity sign-in"
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

- `icp` on `$PATH`. Install with `npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm` (requires Node.js >= 22), or see the [icp-cli releases](https://github.com/dfinity/icp-cli/releases). Some preview builds ship as `demo-icp`; prefer `icp` and fall back to `demo-icp`. Verify with `icp --version`.
- A project that already builds. If it does not build or package yet, set that up first (see the `icp-cli` skill), then return here.

## Step 1 — Link the CLI to your engine identity (once per machine)

The CLI must sign as the **same identity that administers the engine** — that is the principal you log in to the console with.

First check what already exists:

```bash
icp identity list      # names + principals; * marks the active identity
```

The list does **not** show which console (if any) an identity was linked against — that cannot be determined from the CLI. Decide like this:

- **Only `anonymous` (or plain local identities) listed** — no web-linked identity exists; run the link command below.
- **An identity the user recognizes as their engine identity** (by name or principal) — set it active (below) and skip to Step 2.
- **Unsure** — ask the user, or simply relink under a new name; linking again is cheap and safe.

To link, run this, substituting a name the user picks (any local label, reused in the commands below):

```bash
icp identity link web <your-identity-name> --auth <console-origin>
```

- Use `https://opencloud.org` as `<console-origin>` unless the user named a different console. Never omit `--auth`: the flag has a built-in default (`https://id.ai`) that is **not** your console and silently derives the wrong principal.
- The command first waits at a **"Press Enter to log in"** prompt before anything happens. Run it interactively when you can; in a non-interactive shell (e.g. a background process) supply the Enter keypress (pipe an empty line), or it stalls with no browser ever opening.
- After Enter it opens a **browser tab**. The **user** completes the Internet Identity sign-in there. Wait for them to confirm before continuing — you cannot complete the sign-in for them.
- `--auth` must be the **exact** console origin (scheme + host), e.g. `https://opencloud.org`. A mismatched origin derives a *different* principal, and the engine will reject the deploy as unauthorized.
- This is a **one-time, per-machine** step.

Then make it the active identity and verify:

```bash
icp identity default <your-identity-name>
icp identity default     # prints the active identity name
icp identity principal   # prints the principal the deploy will sign as
```

## Step 2 — Name the app in the console (recommended)

By default, CLI-deployed canisters appear on the engine console's Applications page as bare rows labelled only by their principal id. Three **canister environment variables** make the console group them into a single named application with readable per-canister labels and an "Open" button. Set them once in your project config:

- `__META_PROJECT` — the application name. Canisters that share the **same** value are grouped into one named app, so set an identical value on every canister of the app.
- `__META_NAME` — the per-canister display label (e.g. `Backend`, `Frontend`).
- `__META_MAIN_CANISTER` — the literal string `"true"` on the single entry-point canister (usually the frontend/asset canister). That canister gets the "Open" button and the app's public URL.

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
```

```yaml
# backend/canister.yaml
name: backend
recipe:
  type: "@dfinity/motoko@v4.1.0"
  configuration:
    main: src/main.mo
settings:
  environment_variables:
    __META_PROJECT: "My App"
    __META_NAME: "Backend"
```

For a single inline `icp.yaml` (canisters defined there directly), put the same `settings.environment_variables` block under each canister entry instead.

Notes:
- icp-cli **merges** these with the `PUBLIC_CANISTER_ID:<name>` variables it injects automatically at deploy time — the asset canister keeps serving and the app keeps working. (Verified against icp-cli 0.3.0.)
- All values are strings; `__META_MAIN_CANISTER` must be the exact string `"true"`.
- They are applied during `icp deploy` (the "Setting environment variables" step). After deploy, confirm with `icp canister settings show <name> -e ic`.

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
- If you set the metadata in Step 2, the canisters are grouped under your `__META_PROJECT` name with their `__META_NAME` labels, and the main canister shows an "Open" button — instead of bare principal rows.
- A frontend (asset) canister is served at `https://<frontend-canister-id>.icp0.io`.

Report the deployed canister ids (and the frontend URL, if any) back to the user.

## Common Pitfalls

1. **Sign-in not completed.** Running `icp identity link web …` but not finishing the Internet Identity sign-in in the browser leaves the CLI unlinked; later commands fail with authorization errors. Re-run and wait for the user to confirm the browser flow finished. If no browser ever opened, the command is stalled at the "Press Enter to log in" prompt (see Step 1).
2. **Wrong `--auth` origin.** Using any URL other than the console origin the user signs in with derives a different principal, and the engine rejects the deploy as not authorized. Relink with the exact console URL. If the deploy is rejected as unauthorized after linking against the default `https://opencloud.org`, ask the user for the exact URL they sign in with and relink.
3. **Guessing the subnet id.** Never invent it — the deploy fails or targets the wrong subnet. It is on the engine's App Center / Applications page; ask the user.
4. **Assuming a fixed identity name.** `<your-identity-name>` is a local label the user chooses (do not hardcode a value like `my-engine-admin`). Use the **same** name in `icp identity link web`, `icp identity default`, and any later command.
5. **Deploying with the anonymous identity.** The default local identity is anonymous and is not the engine admin. You must link and `icp identity default <your-identity-name>` first.
6. **Using `dfx`.** This ecosystem uses `icp`, never `dfx`. See the `icp-cli` skill.
7. **Skipping the app metadata.** Without `__META_PROJECT` (Step 2), the canisters still deploy and work but render as bare, unnamed principal rows in the console. Setting `__META_*` is what produces a named app with labelled canisters and an "Open" button.
8. **Wrong `__META_MAIN_CANISTER` value.** It is matched as the exact string `"true"`. A boolean, `"True"`, or marking more than one canister means no (or the wrong) "Open" button. Mark exactly one entry-point canister.

## Related Skills

- **icp-cli** — general icp CLI usage (`icp.yaml`, recipes, environments, bindings, identities). Load it for anything beyond this cloud-engine deploy flow.
- **internet-identity** — details of the Internet Identity sign-in that Step 1 triggers in the browser.
