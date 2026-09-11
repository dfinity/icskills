---
name: autoupgrade-icp-cli
description: One-time installer that keeps a project's Internet Computer CLI toolchain current. Sets up a SessionStart hook plus a script that compares the installed `icp` and `ic-wasm` against the latest release and either reports the upgrade or applies it, using whichever channel each tool was installed from (npm, Homebrew, or the shell installer). Use when a user wants to install, bootstrap, or enable automatic icp-cli / ic-wasm updates, asks to stop running an outdated `icp`, asks how to upgrade or check the version of the ICP CLI, or pastes the link to this skill. This is a one-time setup action, not ongoing IC knowledge. Do NOT use for writing icp.yaml, deploying canisters, or other icp-cli usage questions — load `icp-cli` for those.
license: Apache-2.0
compatibility: "curl, bash; network access to github.com (and formulae.brew.sh for Homebrew installs)"
metadata:
  title: Automatically Upgrade the ICP CLI
  category: Infrastructure
---

# Set up automatic `icp` CLI upgrades

This skill installs a small amount of project configuration so that **every new
Claude Code session checks whether `icp` and `ic-wasm` are current** — and, if the
user wants, upgrades them before any work starts.

It is a **one-time installer**. After you complete the steps below, the user never
needs this link again — the installed `SessionStart` hook does the work from then on.

Both tools are covered because they ship as a pair (`npm install -g @icp-sdk/icp-cli
@icp-sdk/ic-wasm`) and the official recipes (`@dfinity/motoko`, `@dfinity/rust`,
`@dfinity/static-site`, `@dfinity/asset-canister`) call `ic-wasm` during every build.
An `ic-wasm` left behind while `icp` moves forward produces build failures that look
like recipe bugs, so upgrading only one of them is the worse default.

## Why this beats the CLI's own update check

`icp` already has a built-in check (`icp settings update-check`), and it is worth
leaving enabled — but it only speaks when the user runs an `icp` command, and by then
the agent has already chosen which commands to write. This hook runs **before** the
session's first prompt, so:

- The version lands in Claude's context up front, so it can pick flags and recipe
  versions that exist in the installed CLI instead of discovering the mismatch from a
  failed command.
- `ic-wasm` is checked too, which the built-in check does not cover.
- The upgrade command matches the channel the tool was **actually** installed from,
  and in auto mode it is applied rather than printed.

## What you will create

1. `.claude/upgrade-icp-cli.sh` — the version-check script.
2. A `SessionStart` hook in `.claude/settings.json` that runs it.
3. An immediate first run, so the user sees the current state right away.

## Step 1 — Ask the user which mode they want

This is the one decision the installer cannot make for the user, so ask before writing
anything. A CLI upgrade can change build behaviour mid-project, and some teams pin the
toolchain deliberately:

> "Two options for how the hook behaves when a newer version exists:
> **notify** — it prints the versions and the exact upgrade command, and nothing is
> installed until you run it. **auto** — it runs that upgrade itself at session start.
> Which do you want? You can switch later by editing one flag in the hook."

Default to **notify** if the user has no preference — it is the reversible choice, and
switching to auto later is a one-word edit.

Also tell the user what adding a hook means:

> "I'm adding a `SessionStart` hook that runs `.claude/upgrade-icp-cli.sh`. Claude Code
> will ask you to approve/trust it before it runs automatically."

Do **not** attempt to bypass that approval.

## Step 2 — Check prerequisites

The script needs `curl` (virtually always present) and at least one of the two tools
installed — it reports on what is there and never installs a tool the user does not
already have:

```bash
command -v curl    >/dev/null 2>&1 && echo "curl: ok"    || echo "curl: MISSING"
icp --version      2>/dev/null     || echo "icp: not installed"
ic-wasm --version  2>/dev/null     || echo "ic-wasm: not installed"
```

If either tool is missing, mention the install command
(`npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm`) but do not run it unprompted —
installing a toolchain is a different decision from keeping one current.

Note that no `jq` is needed here (unlike `autosync-ic-skills`); the script parses
versions with POSIX tools only.

## Step 3 — Download the script

The script is published as a file alongside this skill, so fetch it verbatim rather
than transcribing it — that guarantees byte-exact content and keeps the channel
detection correct as it is updated upstream:

```bash
mkdir -p .claude
curl -fsSL https://skills.internetcomputer.org/.well-known/skills/autoupgrade-icp-cli/scripts/upgrade-icp-cli.sh \
  -o .claude/upgrade-icp-cli.sh
```

Do **not** hand-write or paraphrase it.

## Step 4 — Register the SessionStart hook (idempotently)

Add a `SessionStart` hook to `.claude/settings.json`.

- If `.claude/settings.json` does **not** exist, create it with the content below.
- If it **does** exist, **merge** — preserve all existing keys, hooks, and permissions.
  Only add the `SessionStart` entry, and **only if an equivalent
  `bash .claude/upgrade-icp-cli.sh` command is not already present** (do not create a
  duplicate). Parse the existing JSON, insert into the `hooks.SessionStart` array, and
  write it back; never blindly overwrite the file.

**Notify mode** (the default):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "bash .claude/upgrade-icp-cli.sh --mode notify" }
        ]
      }
    ]
  }
}
```

**Auto mode** — same entry with `--mode auto`, plus a raised `timeout`. Installing a
CLI binary can take well over the default 60 s hook timeout on a slow connection, and
a timed-out upgrade leaves the tool half-installed:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "bash .claude/upgrade-icp-cli.sh --mode auto", "timeout": 300 }
        ]
      }
    ]
  }
}
```

Switching modes later is just editing that `--mode` flag (and adding or dropping the
`timeout`).

Whenever you hand someone an auto-mode hook, say the thing that makes it a real
choice: it upgrades the build toolchain **while a project is open**, so a session can
start against a different `icp` than the last one ended with. That is exactly what
some teams want and exactly what others pin against.

## Step 5 — Run it once now

```bash
bash .claude/upgrade-icp-cli.sh --mode notify   # or --mode auto, matching the hook
```

Run it with the same mode you registered, so the user sees exactly what the hook will
do. When both tools are current the script prints nothing and exits 0 — silence is the
success case, not a failure.

A hand-run always checks the network; the hook does not (see the throttle below), so
this is also the command to reach for whenever someone wants an answer *now*.

## Step 6 — Verify and report

- Confirm `.claude/upgrade-icp-cli.sh` exists and the hook entry is in
  `.claude/settings.json` exactly once.
- Report the versions the run found, whether anything was upgraded, and which mode is
  now installed.
- Remind the user they will be prompted to trust the hook before it auto-runs next
  session.
- If the project commits `.claude/`, add `.claude/.icp-upgrade-check` to `.gitignore` —
  it is a per-machine timestamp, not shared configuration.

## How the script decides what to run

It resolves each binary through its symlinks and reads the install channel off the
path, because the upgrade command is different for each and guessing wrong leaves two
copies of the CLI on `PATH` shadowing each other:

| Where the binary resolves to | Channel | Upgrade command | Latest version read from |
|---|---|---|---|
| `…/node_modules/@icp-sdk/…` | npm | `npm install -g <pkg>@latest` | GitHub release tag |
| `…/Cellar/…` | Homebrew | `brew upgrade <formula>` | `formulae.brew.sh` API |
| a cargo-dist receipt in `~/.config/<app>/` | shell installer | `icp-cli-update` / `ic-wasm-update` | GitHub release tag |
| anything else | unknown | *(none — reports the release URL instead)* | GitHub release tag |

Homebrew is asked for its own formula version rather than the GitHub tag: the formula
can trail a release by a day or two, and nagging about a version `brew upgrade` cannot
yet install is pure noise.

The GitHub lookup follows the `/releases/latest` redirect instead of calling the API,
so it needs no token and cannot hit the 60-requests-per-hour anonymous rate limit —
which a hook that fires on every session start otherwise would.

## Behaviour worth knowing

- **Silent when there is nothing to say.** Output appears only when a tool is behind,
  missing, or an upgrade failed. A `SessionStart` hook's plain stdout reaches Claude as
  context but is never shown to the user, so the script emits one JSON object instead:
  `systemMessage` (rendered to the user as a system notice) and `additionalContext`
  (given to Claude). Run from a terminal it prints plain text. Diagnostics go to stderr
  and are not displayed either way.
- **Never fails the session.** Network failures, an unreachable registry, or a failed
  package manager all exit 0 with a note. A broken upgrade must not block work.
- **Throttled, because the hook blocks session start.** The two version probes cost
  roughly a second, which is too much to pay on every session, so a check that reached
  a release feed is stamped in `.claude/.icp-upgrade-check` and not repeated for 6
  hours — a throttled run costs about 10 ms. Releases land every few weeks, so this
  loses nothing. Override with `ICP_UPGRADE_CHECK_INTERVAL=<seconds>` (`0` disables the
  throttle entirely), and bypass it once with `--force`. A run from a terminal always
  checks. A failed probe is deliberately not stamped, so an offline session retries at
  the next one instead of going quiet for six hours.
- **Never installs what is absent.** A missing tool is reported with its install
  command, even in auto mode — installing a toolchain the user never had is a
  different decision from upgrading one they did.
- **Never sudo.** If the global npm prefix is not writable, auto mode reports
  `sudo npm install -g …` rather than running it; a password prompt inside a hook has
  no terminal to type into and would hang session start.
- **Pre-releases are not downgraded.** A `1.6.0-beta.1` install compares as `1.6.0`,
  so running a beta does not produce an upgrade nag back to the release.
- **Shadowed installs are caught.** If an upgrade succeeds but `PATH` still resolves to
  the old version, the script says so — that means a second copy of the tool (commonly
  an npm global under `nvm` plus a shell-installer copy in `~/.cargo/bin`) is winning
  on `PATH`, and upgrading one will never fix the other.

## What this does *not* upgrade

The hook manages the two CLI binaries only. These are pinned per project and stay the
user's call:

- **Recipe versions** in `icp.yaml` (`@dfinity/motoko@v5.0.0` and friends) — a newer
  `icp` does not change them. Load `icp-cli` for the recipe table and how to bump one.
- **The Motoko toolchain** (`moc`, `mops`, and the `[toolchain]` pin in `mops.toml`) —
  load `mops-cli`.

Upgrading the CLI mid-project can change build output, so if a build starts failing
right after an auto upgrade, check the [icp-cli release
notes](https://github.com/dfinity/icp-cli/releases) before assuming the project broke.

## Additional References

- **`icp-cli`** — using the CLI itself: `icp.yaml`, recipes, environments, deployment.
- **`mops-cli`** — the Motoko toolchain and its own version pinning.
- **`autosync-ic-skills`** — the companion installer that keeps the IC *skills* in
  `.claude/skills/` current. The two are independent; installing both is common.
