---
name: deploy-to-cloud-engine
description: "Deploys an already-built Internet Computer project to a user's own cloud engine (an OpenCloud / control-panel engine, administered from a web console). Covers verifying the icp CLI, linking the user's console identity to the CLI with `icp identity link web`, obtaining the engine's console origin and subnet id (asking the user when they are unknown), and running `icp deploy` against that subnet. Use when a developer wants to ship an app to their cloud engine, mentions a cloud engine, OpenCloud, an engine subnet id, or linking the icp CLI to an engine console. Do NOT use for a general mainnet deploy with no specific engine or subnet (use the icp-cli skill) or for writing canister code."
license: Apache-2.0
compatibility: "icp-cli >= 0.1.0, a cloud engine console account, a browser for the Internet Identity sign-in"
metadata:
  title: Deploy to Cloud Engine
  category: Infrastructure
---

# Deploy to Cloud Engine

## What This Is

A **cloud engine** is a user-owned slice of Internet Computer capacity, administered from a web console (for example `https://opencloud.org`). Each engine runs on a single **subnet**. This skill takes a project that already builds and gets it deployed onto that engine, from a coding agent.

This skill only covers the cloud-engine-specific steps: linking the CLI to the engine's console identity, and a subnet-targeted deploy. For everything else about the CLI (`icp.yaml`, recipes, environments, bindings, identities), load the **`icp-cli`** skill.

Before running any `icp` command you are unsure of, run `icp <subcommand> --help` (e.g. `icp identity link --help`, `icp deploy --help`) to confirm the command and flags exist. Do not infer flags. Authoritative reference: https://cli.internetcomputer.org/llms.txt

## What You Need (ask the user when unknown)

Two values, neither of which you can guess. Look for them first in `icp.yaml` or earlier in the conversation; if absent, **ask the user and do not proceed without them**:

1. **Console origin** — the URL the user signs in to their cloud engine console with (commonly `https://opencloud.org`). It is used as the `--auth` origin in Step 1 so the linked CLI identity derives the **same principal that administers the engine**.
   - Ask: "What URL do you sign in to your cloud engine console with?"
2. **Subnet id** — the subnet the engine deploys to, required by `icp deploy --subnet`. The user finds it on the engine's **App Center / Applications** page in the console.
   - Ask: "What is your engine's subnet id? It is shown on your engine's App Center / Applications page."

Record both so you do not re-ask within the session.

## Prerequisites

- `icp` on `$PATH`. Install with `npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm` (requires Node.js >= 22), or see the [icp-cli releases](https://github.com/dfinity/icp-cli/releases). Some preview builds ship as `demo-icp`; prefer `icp` and fall back to `demo-icp`. Verify with `icp --version`.
- A project that already builds. If it does not build or package yet, set that up first (see the `icp-cli` skill), then return here.

## Step 1 — Link the CLI to your engine identity (once per machine)

The CLI must sign as the **same identity that administers the engine** — that is the principal you log in to the console with. Run this, substituting a name the user picks (any local label, reused in the commands below):

```bash
icp identity link web <your-identity-name> --auth <console-origin>
```

- This opens a **browser tab**. The **user** completes the Internet Identity sign-in there. Wait for them to confirm before continuing — you cannot complete the sign-in for them.
- `--auth` must be the **exact** console origin (scheme + host), e.g. `https://opencloud.org`. A mismatched origin derives a *different* principal, and the engine will reject the deploy as unauthorized.
- This is a **one-time, per-machine** step. If the machine is already linked, skip to Step 2.

Then make it the active identity:

```bash
icp default <your-identity-name>
```

## Step 2 — Deploy to the engine's subnet

From the project root:

```bash
icp deploy -e ic --subnet <subnet-id>
```

- `-e ic` targets mainnet (the engine runs on an IC subnet); `--subnet <subnet-id>` pins the deploy to **your engine's** subnet. Confirm the exact flags with `icp deploy --help` before running if unsure.
- Deploying consumes capacity on the engine; make sure the engine has room.

**Alternative — packaged upload.** If the project is distributed as a built `.icp` package and a direct `icp deploy` is not available, upload the bundle on the console's App Center via **"Upload a custom app"** instead.

## Step 3 — Verify

- The `icp deploy` output reports the deployed canister ids.
- The canisters appear on the engine's **Applications** page in the console.

Report the deployed canister ids (and the frontend URL, if any) back to the user.

## Common Pitfalls

1. **Sign-in not completed.** Running `icp identity link web …` but not finishing the Internet Identity sign-in in the browser leaves the CLI unlinked; later commands fail with authorization errors. Re-run and wait for the user to confirm the browser flow finished.
2. **Wrong `--auth` origin.** Using any URL other than the console origin derives a different principal, and the engine rejects the deploy as not authorized. Relink with the exact console URL the user signs in with.
3. **Guessing the subnet id.** Never invent it — the deploy fails or targets the wrong subnet. It is on the engine's App Center / Applications page; ask the user.
4. **Assuming a fixed identity name.** `<your-identity-name>` is a local label the user chooses (do not hardcode a value like `my-engine-admin`). Use the **same** name in `icp identity link web`, `icp default`, and any later command.
5. **Deploying with the anonymous identity.** The default local identity is anonymous and is not the engine admin. You must link and `icp default <your-identity-name>` first.
6. **Using `dfx`.** This ecosystem uses `icp`, never `dfx`. See the `icp-cli` skill.

## Related Skills

- **icp-cli** — general icp CLI usage (`icp.yaml`, recipes, environments, bindings, identities). Load it for anything beyond this cloud-engine deploy flow.
- **internet-identity** — details of the Internet Identity sign-in that Step 1 triggers in the browser.
