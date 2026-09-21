#!/usr/bin/env bash
# Open a sync issue, closing any stale one for the same upstream afterwards.
# The issue label must already exist in the repository.
#
# The new issue is created BEFORE the stale one is closed: if creation fails, the
# existing issue stays open and the upstream sync remains tracked, rather than
# leaving the repo with no open issue at all.
#
# Usage:
#   scripts/sync-upstream-open-issue.sh <label> <title> <body-file>
#
# Requires GH_TOKEN in environment.

set -uo pipefail

LABEL="$1"
TITLE="$2"
BODY_FILE="$3"

OPEN_ISSUE=$(gh issue list \
  --label "$LABEL" \
  --state open \
  --limit 1 \
  --json number,title \
  --jq 'first // empty')

STALE_NUM=""
if [ -n "$OPEN_ISSUE" ]; then
  STALE_NUM=$(echo "$OPEN_ISSUE" | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
  ISSUE_TITLE=$(echo "$OPEN_ISSUE" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")

  if [ "$ISSUE_TITLE" = "$TITLE" ]; then
    echo "Issue #$STALE_NUM already open for this release — skipping"
    exit 0
  fi
fi

NEW_URL=$(gh issue create \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label "$LABEL") || {
  echo "ERROR: could not create the sync issue." >&2
  [ -n "$STALE_NUM" ] && echo "Left stale issue #$STALE_NUM open so the sync stays tracked." >&2
  exit 1
}
echo "Opened $NEW_URL"

if [ -n "$STALE_NUM" ]; then
  gh issue close "$STALE_NUM" \
    --comment "Superseded by ${NEW_URL}: a newer release is now available. When syncing, target the new release directly; you do not need to sync through the intermediate release this issue tracked."
  echo "Closed stale issue #$STALE_NUM"
fi
