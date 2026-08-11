#!/usr/bin/env bash
# Compute the upstream skill diff between two commits and write an issue body.
#
# Usage:
#   scripts/sync-upstream-check.sh <org/repo> <old-sha> <new-sha> <current-label> <latest-label> <output-file>
#
# <current-label>/<latest-label> are display strings only (a release tag for
# release-tracked repos, or a short commit SHA for commit-tracked repos like
# caffeinelabs/skills). The actual diff is always between <old-sha> and <new-sha>.
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

: "${GH_TOKEN:?GH_TOKEN environment variable is required}"

if [ "$OLD_SHA" = "$NEW_SHA" ]; then
  echo "New tag $LATEST_TAG resolves to the same commit as $CURRENT_TAG — no content changes"
  exit 0
fi

# Skill mappings: "upstream-name:local-name" entries, one per line.
# Upstream files live at <SKILLS_BASE_PATH>/<upstream-name>/ in the upstream repo
# (SKILLS_BASE_PATH may be empty, in which case files live at <upstream-name>/).
# Local files live at skills/<local-name>/ in this repo.
case "$REPO" in
  caffeinelabs/skills)
    # No releases/tags; tracked by commit. The three Motoko skills share one pinned commit.
    SKILLS_BASE_PATH="skills"
    SKILLS="writing-motoko:writing-motoko
migrating-motoko-actors:migrating-motoko-actors
troubleshooting-motoko-migrations:troubleshooting-motoko-migrations"
    ;;
  caffeinelabs/mops)
    SKILLS_BASE_PATH=".agents/skills"
    SKILLS="mops-cli:mops-cli"
    ;;
  dfinity/certified-assets)
    # certified-assets keeps its user docs at docs/ in the repo root.
    SKILLS_BASE_PATH=""
    SKILLS="docs:static-site"
    ;;
  *)
    echo "Unknown repo: $REPO" >&2
    exit 2
    ;;
esac

REPO_SHORT="${REPO##*/}"

# Fetch a repo tree recursively ONCE per commit SHA, cached to a temp file and echoed as its
# path. Git trees are immutable per SHA, so caching is safe and avoids re-fetching the same
# (potentially large) tree once per skill. Fails (non-zero) on a fetch error.
#   $1 = commit SHA  →  prints the cache file path on stdout
fetch_tree() {
  local sha="$1"
  # Repo-scoped, SHA-keyed cache under the runner temp dir (falls back to /tmp locally).
  local cache="${RUNNER_TEMP:-/tmp}/upstream-tree-${REPO//\//-}-${sha}.json"
  if [ ! -s "$cache" ]; then
    local tmp="${cache}.tmp.$$"
    curl -sf "https://api.github.com/repos/${REPO}/git/trees/${sha}?recursive=1" \
      -H "Authorization: Bearer $GH_TOKEN" > "$tmp" || {
      echo "ERROR: could not fetch git tree for ${REPO}@${sha}" >&2
      rm -f "$tmp"
      return 1
    }
    mv -f "$tmp" "$cache"  # atomic: the cache file is only ever complete or absent
  fi
  printf '%s' "$cache"
}

# List files under a skill path at a commit, RECURSIVELY (paths relative to the skill path),
# from the cached tree. The Contents API is non-recursive and would miss nested files such as
# writing-motoko/references/*. Fails (non-zero) on a fetch error, unparseable response, or a
# truncated tree — the caller aborts rather than treating an incomplete listing as "no changes".
#   $1 = commit SHA, $2 = skill path
list_skill_files() {
  local cache
  cache=$(fetch_tree "$1") || return 1
  python3 -c "
import sys, json
prefix = sys.argv[2].rstrip('/') + '/'
try:
    d = json.load(open(sys.argv[1]))
except Exception as err:
    sys.stderr.write('ERROR: could not parse git tree JSON: %s\n' % err)
    sys.exit(1)
if d.get('truncated'):
    sys.stderr.write('ERROR: git tree truncated; cannot reliably enumerate %s\n' % sys.argv[2])
    sys.exit(1)
for e in d.get('tree', []):
    if e.get('type') == 'blob' and e['path'].startswith(prefix):
        print(e['path'][len(prefix):])
" "$cache" "$2"
}

{
  echo "## Upstream diff: \`${REPO}\` \`${CURRENT_TAG}\` → \`${LATEST_TAG}\`"
  echo ""
  echo "Commit: [\`${NEW_SHA:0:12}\`](https://github.com/${REPO}/commit/${NEW_SHA})"
  echo ""
  echo "To sync: create branch \`chore/sync-upstream-${REPO_SHORT}-${LATEST_TAG}\`, follow the"
  echo "[Upstream Sync Strategy](https://github.com/dfinity/icskills/blob/main/.claude/CLAUDE.md#upstream-sync-strategy)"
  echo "in CLAUDE.md, run \`npm run validate\`, and open a PR that closes this issue."
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
  if [ -n "$SKILLS_BASE_PATH" ]; then
    skill_path="${SKILLS_BASE_PATH}/${upstream_name}"
  else
    skill_path="${upstream_name}"
  fi

  # Abort the whole run (exit 3) if either listing can't be trusted — the workflow's
  # diff step re-raises any non-0/1 code, so the job fails loudly instead of opening
  # (or skipping) an issue based on incomplete data.
  OLD_FILES=$(list_skill_files "$OLD_SHA" "$skill_path") || exit 3
  NEW_FILES=$(list_skill_files "$NEW_SHA" "$skill_path") || exit 3

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
