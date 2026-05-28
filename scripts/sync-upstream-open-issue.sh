#!/usr/bin/env bash
# Open a sync issue, closing any stale one for the same upstream first.
#
# Usage:
#   scripts/sync-upstream-open-issue.sh <label> <label-color> <label-description> <title> <body-file>
#
# Requires GH_TOKEN in environment.

set -uo pipefail

LABEL="$1"
LABEL_COLOR="$2"
LABEL_DESC="$3"
TITLE="$4"
BODY_FILE="$5"

gh label create "$LABEL" --color "$LABEL_COLOR" \
  --description "$LABEL_DESC" 2>/dev/null || true

OPEN_ISSUE=$(gh issue list \
  --label "$LABEL" \
  --state open \
  --limit 1 \
  --json number,title \
  --jq 'first // empty')

if [ -n "$OPEN_ISSUE" ]; then
  ISSUE_NUM=$(echo "$OPEN_ISSUE" | python3 -c "import sys,json; print(json.load(sys.stdin)['number'])")
  ISSUE_TITLE=$(echo "$OPEN_ISSUE" | python3 -c "import sys,json; print(json.load(sys.stdin)['title'])")

  if [ "$ISSUE_TITLE" = "$TITLE" ]; then
    echo "Issue #$ISSUE_NUM already open for this release — skipping"
    exit 0
  fi

  gh issue close "$ISSUE_NUM" \
    --comment "Superseded: a newer release is now available. Closing — a fresh issue will be opened. When syncing, target the new release directly; you do not need to sync through the intermediate release this issue tracked."
  echo "Closed stale issue #$ISSUE_NUM"
fi

gh issue create \
  --title "$TITLE" \
  --body-file "$BODY_FILE" \
  --label "$LABEL"
