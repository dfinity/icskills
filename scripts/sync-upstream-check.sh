#!/usr/bin/env bash
# Compute the upstream skill diff between two releases and write an issue body.
#
# Usage:
#   scripts/sync-upstream-check.sh <org/repo> <old-sha> <new-sha> <current-tag> <latest-tag> <output-file>
#
# Exit codes:
#   0 — no skill content changed (output file not meaningful)
#   1 — changes found (output file contains issue body)
#
# Requires GH_TOKEN in environment.

set -uo pipefail

REPO="$1"
OLD_SHA="$2"
NEW_SHA="$3"
CURRENT_TAG="$4"
LATEST_TAG="$5"
OUTPUT_FILE="$6"

if [ "$OLD_SHA" = "$NEW_SHA" ]; then
  echo "New tag $LATEST_TAG resolves to the same commit as $CURRENT_TAG — no content changes"
  exit 0
fi

# Skill mappings: "upstream-name:local-name" entries, one per line.
# Upstream files live at .agents/skills/<upstream-name>/ in the upstream repo.
# Local files live at skills/<local-name>/ in this repo.
case "$REPO" in
  caffeinelabs/motoko)
    SKILLS="writing-motoko:motoko
migrating-motoko:migrating-motoko
migrating-motoko-enhanced:migrating-motoko-enhanced"
    ;;
  caffeinelabs/mops)
    SKILLS="mops-cli:mops-cli"
    ;;
  *)
    echo "Unknown repo: $REPO" >&2
    exit 2
    ;;
esac

SKILLS_BASE_PATH=".agents/skills"
REPO_SHORT="${REPO##*/}"

{
  echo "## Upstream diff: \`${REPO}\` \`${CURRENT_TAG}\` → \`${LATEST_TAG}\`"
  echo ""
  echo "Commit: [\`${NEW_SHA:0:12}\`](https://github.com/${REPO}/commit/${NEW_SHA})"
  echo ""
  echo "To sync: create branch \`chore/sync-upstream-${REPO_SHORT}-${LATEST_TAG}\`, follow the"
  echo "[Upstream Sync Strategy](https://github.com/dfinity/icskills/blob/main/.claude/CLAUDE.md#upstream-sync-strategy)"
  echo "in CLAUDE.md, run \`npm run validate\`, and open a PR that closes this issue."
  echo ""
  echo "> **Note:** this diff was computed at issue-open time. Re-run before applying —"
  echo "> changes may have landed on main since."
  echo ""
  echo "**Before applying:** check \`.claude/upstream.md\` for icskills-owned sections."
  echo "Do NOT overwrite those sections from upstream. Also check whether any owned"
  echo "section is now covered by the upstream changes — if so, drop the icskills copy"
  echo "and remove it from the owned list to avoid duplicating content."
  echo ""
} > "$OUTPUT_FILE"

HAS_CHANGES=false

while IFS= read -r skill_pair; do
  [ -z "$skill_pair" ] && continue
  upstream_name="${skill_pair%%:*}"
  local_name="${skill_pair##*:}"
  skill_path="${SKILLS_BASE_PATH}/${upstream_name}"

  OLD_FILES=$(curl -sf \
    "https://api.github.com/repos/${REPO}/contents/${skill_path}?ref=${OLD_SHA}" \
    -H "Authorization: Bearer $GH_TOKEN" | \
    python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin) if f['type'] == 'file']" \
    2>/dev/null || echo "")

  NEW_FILES=$(curl -sf \
    "https://api.github.com/repos/${REPO}/contents/${skill_path}?ref=${NEW_SHA}" \
    -H "Authorization: Bearer $GH_TOKEN" | \
    python3 -c "import sys,json; [print(f['name']) for f in json.load(sys.stdin) if f['type'] == 'file']" \
    2>/dev/null || echo "")

  ALL_FILES=$(printf '%s\n%s\n' "$OLD_FILES" "$NEW_FILES" | sort -u | grep -v '^$' || true)

  SKILL_HAS_CHANGES=false
  > /tmp/skill-diff-body.md

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    curl -sf "https://raw.githubusercontent.com/${REPO}/${OLD_SHA}/${skill_path}/${file}" \
      > /tmp/upstream-old-file 2>/dev/null || > /tmp/upstream-old-file

    curl -sf "https://raw.githubusercontent.com/${REPO}/${NEW_SHA}/${skill_path}/${file}" \
      > /tmp/upstream-new-file 2>/dev/null || > /tmp/upstream-new-file

    DIFF=$(diff /tmp/upstream-old-file /tmp/upstream-new-file || true)
    if [ -n "$DIFF" ]; then
      SKILL_HAS_CHANGES=true
      HAS_CHANGES=true
      {
        echo "#### \`${file}\`"
        echo ""
        echo '<details><summary>Show diff (- old upstream, + new upstream)</summary>'
        echo ""
        echo '```diff'
        echo "$DIFF"
        echo '```'
        echo ""
        echo '</details>'
        echo ""
      } >> /tmp/skill-diff-body.md
    fi
  done <<< "$ALL_FILES"

  if [ "$SKILL_HAS_CHANGES" = "true" ]; then
    {
      echo "### \`${local_name}\` ← upstream \`${upstream_name}\`"
      echo ""
      cat /tmp/skill-diff-body.md
    } >> "$OUTPUT_FILE"
  else
    {
      echo "### \`${local_name}\` — no changes"
      echo ""
    } >> "$OUTPUT_FILE"
  fi
done <<< "$SKILLS"

if [ "$HAS_CHANGES" = "false" ]; then
  echo "No skill content changes detected between $CURRENT_TAG and $LATEST_TAG — skipping issue"
  exit 0
fi

exit 1
