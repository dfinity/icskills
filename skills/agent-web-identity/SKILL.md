---
name: agent-web-identity
description: "Lets an AI agent or CLI session sign in to Internet Identity and act as a user's app-specific principal (e.g. for oisy.com or nns.ic0.app) via `icp identity link web`. Use when the user asks an agent to log in to an II-powered app, obtain a delegation, or make authorized canister calls on their behalf. Do NOT use for adding II sign-in to a frontend — use the internet-identity skill instead."
license: Apache-2.0
compatibility: "icp-cli >= 0.3.0, browser on the same machine"
metadata:
  title: Agent Web Identity Sign-In
  category: Auth
---

# Agent Web Identity Sign-In

## What This Is

Internet Identity (II) supports a CLI-auth flow that issues a delegation for a
session key held *outside* the browser. `icp identity link web` uses it to let
a terminal session — including an AI agent such as Claude Code — sign canister
calls as the user's **app-specific principal**: the same principal the user has
when signed in to that app's web UI (selected with `--app <domain>`).

The user still authenticates interactively in their own browser with their
passkey; the agent only ends up holding a time-limited delegation. The private
key of the user's II identity is never exposed.

## Prerequisites

- `icp` CLI installed (https://cli.internetcomputer.org). See the `icp-cli`
  skill for general usage.
- The user must have an Internet Identity (id.ai) and be present to complete
  the browser sign-in.
- First-time use requires the user to enable the **CLI access** toggle for
  their identity in II settings (see Pitfall 1).
- The agent and the user's browser must be on the same machine: the flow
  delivers the delegation via a localhost callback. It does not work from
  remote/headless environments (containers, CI, web sessions).

## Common Pitfalls

1. **First-time sign-in fails with a "CLI access disabled" screen.** This is
   the expected first-run path, not an error. Tell the user to enable CLI
   access for their identity in II settings, then **restart the flow from
   scratch** — the previous sign-in URL is single-use (its nonce and localhost
   listener are dead). Plan for two rounds on first use.

2. **The link command does not open a browser from an agent shell.** Sandboxed
   or non-interactive shells often can't launch a GUI browser. Never assume it
   opened: read the command's output, find the printed sign-in URL
   (`https://id.ai/cli#...`), and show it to the user to open themselves. If
   no URL is printed, report that — do not construct one by guessing.

3. **The command blocks until sign-in completes and gets killed by tool
   timeouts.** Run `icp identity link web` as a background task, then wait for
   the user to confirm they finished signing in before checking the result.
   The command must also be able to bind a localhost port; if a sandbox blocks
   this, ask the user before rerunning unsandboxed.

4. **Relying on the default identity signs with the wrong principal.** Every
   `icp` command acting as the user must pass `--identity <NAME>` explicitly.
   Never depend on project or global default identity settings, and never
   change them.

5. **Reusing or overwriting identity names.** Generate a fresh, unique name
   (e.g. `agent-<app>-<YYYYMMDD-HHMM>`), and check `icp identity list` first.
   Never overwrite an existing identity.

6. **Wrong principal because `--app` was omitted.** Without `--app`, the
   provider uses its default derivation origin and the resulting principal
   will NOT match the user's principal in the target app. Pass the app's bare
   domain (no scheme, port, or path), e.g. `--app oisy.com`.

7. **Expired delegations.** Delegations are time-limited; the lifetime is set
   by the identity provider during sign-in. `icp identity link web` has NO
   flag to control it — do not invent one (e.g. `--ttl`; 0.3.x rejects it and
   the whole command fails). When calls start failing with signature/expiry
   errors, run `icp identity reauth <NAME>` — the user must sign in again as
   the same identity.

## Implementation

Generalized flow for linking the user into `<APP_DOMAIN>` (e.g. `oisy.com`,
`nns.ic0.app`):

```bash
# 1. Pick a fresh name; confirm it doesn't exist
icp identity list
NAME="agent-<app>-$(date +%Y%m%d-%H%M)"

# 2. Start the link flow IN THE BACKGROUND (keeps the localhost
#    listener alive while the user signs in). Use your harness's
#    background-execution mode if it has one; in a plain shell:
icp identity link web "$NAME" --app <APP_DOMAIN> \
  > "/tmp/icp-link-$NAME.log" 2>&1 &

# 3. Read the command's output (the log file above), find the printed
#    https://id.ai/cli#... URL, and relay it to the user; wait for them
#    to confirm sign-in (first run may require enabling CLI access in
#    II settings — restart from step 2 with a fresh URL if so)

# 4. Confirm the identity was created
icp identity list
```

## Verify It Works

Call the public whoami canister as the linked identity:

```bash
icp canister call --identity "$NAME" --network ic \
  ivcos-eqaaa-aaaab-qablq-cai whoami
```

(Adapt flags to the installed CLI version — see `icp canister call --help` —
but always keep the explicit `--identity`.) The returned principal should
match the principal the app shows the user when they are signed in to
`<APP_DOMAIN>`; ask the user to confirm.

## Security Rules for Agents

- The delegation grants **full authority as the user's app principal** until
  it expires — it is not scoped to specific canisters. Treat it like a signed
  blank check for that app.
- Other than the whoami verification, ask the user explicitly before every
  state-changing canister call made with the linked identity.
- The delegation's lifetime is decided by the identity provider, not the CLI
  — there is no flag to shorten it. When the task is done, don't wait for
  expiry: remove the identity.
- Never export, print, or log the identity's key material; leave it in the
  CLI's default keyring storage.
- When done, remind the user of the identity name and how to remove it:
  `icp identity remove <NAME>`.
