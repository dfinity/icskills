---
name: setup-ic-skills
description: One-time installer that makes a Claude Code project keep its Internet Computer skills up to date automatically. Sets up a SessionStart hook plus a sync script so .claude/skills/ always mirrors the latest skills published at skills.internetcomputer.org. Use when a user wants to install, bootstrap, or enable "always-latest" Internet Computer / IC / ICP / Motoko skills in a project, or pastes the link to this skill. This is a one-time setup action, not ongoing IC knowledge — after it runs, the installed hook keeps skills current on every session. Do NOT use for IC coding questions themselves — this only configures auto-updating skills.
license: Apache-2.0
metadata:
  title: Setup IC Skills
  category: Infrastructure
---

# Set up self-updating Internet Computer skills

This skill installs a small amount of project configuration so that **every new
Claude Code session automatically downloads the latest Internet Computer skills**
into `.claude/skills/`, where Claude discovers and triggers them natively.

It is a **one-time installer**. After you complete the steps below, the user never
needs this link again — the installed `SessionStart` hook does the work from then on.

## What you will create

1. `.claude/sync-ic-skills.sh` — mirrors the live skill index into `.claude/skills/`.
2. A `SessionStart` hook in `.claude/settings.json` that runs that script.
3. An immediate first run, so skills are present right away.

The sync is a **mirror**: it always re-downloads the current skills, so it picks up
new skills, updated versions of existing skills, and removals — with no version
metadata required on the server side.

## Important: tell the user what to expect

Adding a hook means a shell script will run automatically at the start of future
sessions. Claude Code will ask the user to **review and trust** the new hook before
it activates — this is expected and correct. Let the user know:

> "I'm adding a `SessionStart` hook that runs `.claude/sync-ic-skills.sh`. Claude Code
> will ask you to approve/trust it before it runs automatically. After that, your IC
> skills stay current on every session."

Do **not** attempt to bypass that approval.

## Step 0 — Check prerequisites (`curl`, `jq`)

The sync script needs `curl` (virtually always present) and `jq` (often not).
Before writing anything, check for them:

```bash
command -v curl >/dev/null 2>&1 && echo "curl: ok" || echo "curl: MISSING"
command -v jq   >/dev/null 2>&1 && echo "jq: ok"   || echo "jq: MISSING"
```

- If `jq` is **missing**, offer to install it (ask the user before running an install
  command). Pick the right one for their platform:
  - macOS (Homebrew): `brew install jq`
  - Debian/Ubuntu: `sudo apt-get update && sudo apt-get install -y jq`
  - Fedora/RHEL: `sudo dnf install -y jq`
  - Alpine: `apk add jq`
  - Arch: `sudo pacman -S --noconfirm jq`
  - Windows (winget): `winget install jqlang.jq`
- If the user declines, still proceed — the script is written to degrade gracefully
  (it exits cleanly with a warning when `jq` is absent), and they can install `jq`
  later and the next session will sync.

## Step 1 — Write the sync script

Create `.claude/sync-ic-skills.sh` with **exactly** this content:

```bash
#!/usr/bin/env bash
# sync-ic-skills.sh — mirror the latest Internet Computer skills into .claude/skills/
# Idempotent and offline-safe. Only skills this script installed are ever pruned,
# so your own local skills are never touched.
set -euo pipefail

BASE="https://skills.internetcomputer.org/.well-known/skills"
INDEX_URL="$BASE/index.json"
DEST=".claude/skills"
MANIFEST="$DEST/.ic-managed.json"   # tracks which skills this script manages

mkdir -p "$DEST"

# --- Fetch the index. On any network failure, keep cached skills and exit cleanly. ---
TMP_INDEX="$(mktemp)"
trap 'rm -f "$TMP_INDEX"' EXIT
if ! curl -fsSL --max-time 20 "$INDEX_URL" -o "$TMP_INDEX"; then
  echo "[ic-skills] could not reach $INDEX_URL — keeping cached skills" >&2
  exit 0
fi

# --- jq is required to parse the index. If absent, warn and exit without failing. ---
if ! command -v jq >/dev/null 2>&1; then
  echo "[ic-skills] 'jq' not found — install jq to enable IC skill sync" >&2
  exit 0
fi

NEW_NAMES="$(jq -r '.[].name' "$TMP_INDEX")"

# --- Prune: drop previously-managed skills that are no longer in the index. ---
if [ -f "$MANIFEST" ]; then
  while IFS= read -r old; do
    [ -n "$old" ] || continue
    if ! grep -qxF "$old" <<<"$NEW_NAMES"; then
      rm -rf "${DEST:?}/$old"
      echo "[ic-skills] pruned removed skill: $old" >&2
    fi
  done < <(jq -r '.[]?' "$MANIFEST" 2>/dev/null || true)
fi

# --- Download every skill's files (overwrite == always latest). ---
jq -c '.[]' "$TMP_INDEX" | while IFS= read -r entry; do
  name="$(jq -r '.name' <<<"$entry")"
  [ -n "$name" ] && [ "$name" != "null" ] || continue
  mkdir -p "$DEST/$name"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    if ! curl -fsSL --max-time 20 "$BASE/$name/$f" -o "$DEST/$name/$f"; then
      echo "[ic-skills] warning: failed to fetch $name/$f" >&2
    fi
  done < <(jq -r '.files[]?' <<<"$entry")
done

# --- Record managed skill names for the next prune pass. ---
jq '[.[].name]' "$TMP_INDEX" > "$MANIFEST"
echo "[ic-skills] synced $(jq 'length' "$TMP_INDEX") Internet Computer skills into $DEST" >&2
```

## Step 2 — Register the SessionStart hook (idempotently)

Add a `SessionStart` hook to `.claude/settings.json` that runs the script.

- If `.claude/settings.json` does **not** exist, create it with the content below.
- If it **does** exist, **merge** — preserve all existing keys, hooks, and
  permissions. Only add the `SessionStart` entry, and **only if an equivalent
  `bash .claude/sync-ic-skills.sh` command is not already present** (do not create a
  duplicate). Parse the existing JSON, insert into the `hooks.SessionStart` array,
  and write it back; never blindly overwrite the file.

The entry to ensure is present:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "bash .claude/sync-ic-skills.sh" }
        ]
      }
    ]
  }
}
```

## Step 3 — Run it once now

Run the script immediately so the skills are available in this session without
waiting for the next session start:

```bash
bash .claude/sync-ic-skills.sh
```

## Step 4 — Verify and report

- Confirm `.claude/skills/` now contains skill directories (e.g. `motoko`,
  `asset-canister`, `internet-identity`, …) each with a `SKILL.md`.
- Confirm `.claude/skills/.ic-managed.json` lists the synced skill names.
- Tell the user: how many skills were installed, that the `SessionStart` hook is in
  place, and that they'll be prompted to trust the hook before it auto-runs next
  session. From then on, their IC skills refresh automatically every session.

## Notes

- **Safe to re-run.** Re-invoking this skill or the script is idempotent: the hook is
  not duplicated, and only skills tracked in `.ic-managed.json` are ever pruned.
- **No server-side versioning needed.** Because the script re-mirrors current content,
  it captures new skills, new versions, and removals automatically. If the index later
  adds `sha256`/`version` fields, the script can be upgraded to a differential sync,
  but that is not required for correctness.
- **Optional mid-session refresh.** For very long-running sessions, the user can also
  run `bash .claude/sync-ic-skills.sh` manually, or schedule it (e.g. via `/loop` or a
  cron routine) — but the SessionStart hook covers the normal case.
