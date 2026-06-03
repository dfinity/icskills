#!/usr/bin/env bash
# sync-ic-skills.sh — mirror the latest Internet Computer skills into .claude/skills/
#
# Differential sync: fetches the discovery index once and re-downloads only the
# skills whose published `hash` changed (or are new). Skills already at the current
# hash are skipped entirely — no per-file downloads. Prints a one-line summary only
# when something actually changed.
#
# Idempotent and offline-safe. Only skills this script installed are ever pruned,
# so your own local skills are never touched.
set -euo pipefail

BASE="https://skills.internetcomputer.org/.well-known/skills"
INDEX_URL="$BASE/index.json"
DEST=".claude/skills"
MANIFEST="$DEST/.ic-managed.json"   # { "<skill>": "<hash>" } of skills this script manages

mkdir -p "$DEST"

# --- Temp files. NEW_MANIFEST is built up as we go, then swapped in atomically. ---
TMP_INDEX="$(mktemp)"
NEW_MANIFEST="$(mktemp)"
trap 'rm -f "$TMP_INDEX" "$NEW_MANIFEST"' EXIT

# --- Fetch the index. On any network failure, keep cached skills and exit cleanly. ---
if ! curl -fsSL --max-time 20 "$INDEX_URL" -o "$TMP_INDEX"; then
  echo "[autosync-ic-skills] could not reach $INDEX_URL — keeping cached skills" >&2
  exit 0
fi

# --- jq is required to parse the index. If absent, warn and exit without failing. ---
if ! command -v jq >/dev/null 2>&1; then
  echo "[autosync-ic-skills] 'jq' not found — install jq to enable IC skill sync" >&2
  exit 0
fi

# --- Previously-managed skill names. Supports the legacy manifest format
#     (a bare array of names, no hashes) as well as the current object form. ---
managed_names() {
  [ -f "$MANIFEST" ] || return 0
  jq -r 'if type == "object" then keys[] elif type == "array" then .[] else empty end' \
    "$MANIFEST" 2>/dev/null || true
}

# --- Stored hash for a skill, or empty if unknown (new skill, or legacy manifest). ---
stored_hash() {
  [ -f "$MANIFEST" ] || return 0
  jq -r --arg n "$1" 'if type == "object" then (.[$n] // "") else "" end' \
    "$MANIFEST" 2>/dev/null || true
}

# --- Append a name->hash pair to the new manifest being built. ---
record() {
  local tmp; tmp="$(mktemp)"
  jq --arg n "$1" --arg h "$2" '.[$n] = $h' "$NEW_MANIFEST" > "$tmp" && mv "$tmp" "$NEW_MANIFEST"
}

NEW_NAMES="$(jq -r '.skills[].name' "$TMP_INDEX")"
MANAGED="$(managed_names)"
echo '{}' > "$NEW_MANIFEST"

# --- Prune: drop previously-managed skills that are no longer in the index. ---
removed=0
while IFS= read -r old; do
  [ -n "$old" ] || continue
  if ! grep -qxF "$old" <<<"$NEW_NAMES"; then
    rm -rf "${DEST:?}/$old"
    removed=$((removed + 1))
    echo "[autosync-ic-skills] removed: $old" >&2
  fi
done <<<"$MANAGED"

# --- Sync: download only skills whose hash changed (new / hashless always download). ---
added=0; updated=0; unchanged=0
while IFS= read -r entry; do
  name="$(jq -r '.name' <<<"$entry")"
  [ -n "$name" ] && [ "$name" != "null" ] || continue
  new_hash="$(jq -r '.hash // ""' <<<"$entry")"
  old_hash="$(stored_hash "$name")"

  # Skip when the hash is known, unchanged, and the files are already on disk.
  if [ -n "$new_hash" ] && [ "$new_hash" = "$old_hash" ] && [ -d "$DEST/$name" ]; then
    unchanged=$((unchanged + 1))
    record "$name" "$new_hash"
    continue
  fi

  # Otherwise (re)download every file for this skill.
  ok=1
  mkdir -p "$DEST/$name"
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    mkdir -p "$(dirname "$DEST/$name/$f")"   # files may live in subdirs (e.g. scripts/)
    if ! curl -fsSL --max-time 20 "$BASE/$name/$f" -o "$DEST/$name/$f"; then
      echo "[autosync-ic-skills] warning: failed to fetch $name/$f" >&2
      ok=0
    fi
  done < <(jq -r '.files[]?' <<<"$entry")

  if [ "$ok" -eq 1 ]; then
    # Record the new hash so the next run can skip this skill. A hashless server
    # records an empty hash, which never equals new_hash -> always re-downloads.
    record "$name" "$new_hash"
    if grep -qxF "$name" <<<"$MANAGED"; then
      updated=$((updated + 1))
    else
      added=$((added + 1))
    fi
  else
    # Download incomplete: keep the old hash so the next run retries this skill.
    record "$name" "$old_hash"
  fi
done < <(jq -c '.skills[]' "$TMP_INDEX")

# --- Swap in the updated manifest. ---
mv "$NEW_MANIFEST" "$MANIFEST"

# --- Report only when something changed; stay silent on a no-op sync. ---
# SessionStart hook stdout/stderr is NOT shown in the Claude Code UI — only JSON
# fields are surfaced. We emit a single JSON object on stdout:
#   - systemMessage    -> rendered to the USER as a visible system notice
#   - additionalContext -> injected into Claude's context so it can mention it too
if [ $((added + updated + removed)) -gt 0 ]; then
  summary="[autosync-ic-skills] ${added} added, ${updated} updated, ${removed} removed (${unchanged} unchanged) in $DEST"
  jq -n --arg msg "$summary" '{
    systemMessage: $msg,
    hookSpecificOutput: {
      reloadSkills: true,
      hookEventName: "SessionStart",
      additionalContext: $msg
    }
  }'
fi
