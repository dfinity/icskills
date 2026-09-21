#!/usr/bin/env python3
"""Render the upstream-sync issue body within GitHub's issue-body size limit.

Reads the TSV index written by sync-upstream-check.sh (SKILL and DIFF records, in
discovery order) and emits a markdown body no larger than --budget characters.

Both renderings of every diff — inlined and stubbed — are produced up front, so
selection works on exact sizes. A diff is only a candidate for omission when its
stub is actually smaller than inlining it; that keeps a small diff from being
replaced by a stub that costs more than the diff it replaces.

Remaining diffs are selected by priority: SKILL.md first (that is where
icskills-owned sections live and where the sync needs judgment), then
smallest-first so as many as possible fit. Whatever does not fit is stubbed with
the exact commands to reproduce it. The body always opens with those commands, so
an omitted diff is never a dead end.
"""

import argparse
import os

RAW = "https://raw.githubusercontent.com"
HARD_LIMIT = 65536  # GitHub rejects issue bodies above this.
MAX_LISTED_FILES = 25  # Per skill, in the header's path listing.
NOTICE_HEADROOM = 200  # Room reserved for the trailing 'sections dropped' notice.


def parse_index(path):
    """Return skills in discovery order: [{local, upstream, path, diffs: [...]}]."""
    skills, by_local = [], {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            line = line.rstrip("\n")
            if not line:
                continue
            kind, *rest = line.split("\t")
            if kind == "SKILL":
                local, upstream, skill_path = rest
                entry = {
                    "local": local,
                    "upstream": upstream,
                    "path": skill_path,
                    "diffs": [],
                }
                skills.append(entry)
                by_local[local] = entry
            elif kind == "DIFF":
                local, filename, diff_path = rest
                by_local[local]["diffs"].append(
                    {"file": filename, "diff_path": diff_path}
                )
    return skills


def repro_commands(repo, old_sha, new_sha, skill_path, filename):
    return "\n".join(
        [
            "```bash",
            f'curl -sf "{RAW}/{repo}/{old_sha}/{skill_path}/{filename}" > /tmp/upstream-old',
            f'curl -sf "{RAW}/{repo}/{new_sha}/{skill_path}/{filename}" > /tmp/upstream-new',
            "diff /tmp/upstream-old /tmp/upstream-new",
            "```",
        ]
    )


def render_inline(entry, diff_text):
    return "\n".join(
        [
            f"#### `{entry['file']}`",
            "",
            "<details><summary>Show diff (`<` old upstream, `>` new upstream)</summary>",
            "",
            "```diff",
            diff_text,
            "```",
            "",
            "</details>",
            "",
        ]
    )


def render_stub(entry, diff_text, args, skill_path):
    lines = diff_text.count("\n") + 1
    kb = len(diff_text.encode("utf-8")) / 1024
    return "\n".join(
        [
            f"#### `{entry['file']}` — diff omitted ({lines} lines, {kb:.1f} KB)",
            "",
            "Too large to inline under GitHub's issue-body limit. Reproduce it with:",
            "",
            repro_commands(
                args.repo, args.old_sha, args.new_sha, skill_path, entry["file"]
            ),
            "",
        ]
    )


def prepare(skills, args):
    """Attach exact inline/stub renderings to every diff entry."""
    for skill in skills:
        for entry in skill["diffs"]:
            with open(entry["diff_path"], encoding="utf-8", errors="replace") as fh:
                diff_text = fh.read().rstrip("\n")
            entry["inline"] = render_inline(entry, diff_text)
            entry["stub"] = render_stub(entry, diff_text, args, skill["path"])
            entry["is_skill_md"] = (
                os.path.basename(entry["file"]).lower() == "skill.md"
            )


def select(skills, budget):
    """Choose which diffs to inline. Returns the set of entry ids to inline."""
    forced, optional = [], []
    for skill in skills:
        for entry in skill["diffs"]:
            # Stubbing only helps when the stub is genuinely smaller. Otherwise
            # inlining is both cheaper and more useful, so never stub it.
            if len(entry["stub"]) >= len(entry["inline"]):
                forced.append(entry)
            else:
                optional.append(entry)

    inlined = {id(e) for e in forced}
    # Every entry costs at least its stub; the budget must cover those regardless.
    remaining = budget - sum(len(e["inline"]) for e in forced)
    remaining -= sum(len(e["stub"]) for e in optional)

    # SKILL.md first; then smallest-first so the budget covers as many files as it can.
    optional.sort(key=lambda e: (0 if e["is_skill_md"] else 1, len(e["inline"])))

    for entry in optional:
        upgrade = len(entry["inline"]) - len(entry["stub"])
        if upgrade <= remaining:
            inlined.add(id(entry))
            remaining -= upgrade
    return inlined


def build_header(args, skills):
    lines = [
        f"## Upstream diff: `{args.repo}` `{args.current_tag}` → `{args.latest_tag}`",
        "",
        f"Commit: [`{args.new_sha[:12]}`](https://github.com/{args.repo}/commit/{args.new_sha})",
        "",
        f"To sync: create branch `chore/sync-upstream-{args.repo_short}-{args.latest_tag}`, follow the",
        "[Upstream Sync Strategy](https://github.com/dfinity/icskills/blob/main/.claude/CLAUDE.md#upstream-sync-strategy)",
        "in CLAUDE.md, run `npm run validate`, and open a PR that closes this issue.",
        "",
        "**Before applying:** check `.claude/upstream.md` for icskills-owned sections.",
        "Do NOT overwrite those sections from upstream. Also check whether any owned",
        "section is now covered by the upstream changes — if so, drop the icskills copy",
        "and remove it from the owned list to avoid duplicating content.",
        "",
        "### Reproducing the full diff",
        "",
        "The diffs below are a convenience snapshot and may be abbreviated to fit"
        " GitHub's issue-body limit.",
        "To regenerate any file's complete diff, substitute its path into:",
        "",
        "```bash",
        f'OLD="{args.old_sha}"',
        f'NEW="{args.new_sha}"',
        f'curl -sf "{RAW}/{args.repo}/$OLD/<path>" > /tmp/upstream-old',
        f'curl -sf "{RAW}/{args.repo}/$NEW/<path>" > /tmp/upstream-new',
        "diff /tmp/upstream-old /tmp/upstream-new",
        "```",
        "",
        "Upstream paths covered by this issue:",
        "",
    ]
    for skill in skills:
        if not skill["diffs"]:
            continue
        shown = skill["diffs"][:MAX_LISTED_FILES]
        files = ", ".join(f"`{d['file']}`" for d in shown)
        extra = len(skill["diffs"]) - len(shown)
        if extra:
            files += f", + {extra} more"
        lines.append(f"- `{skill['path']}/` → `skills/{skill['local']}/` — {files}")
    lines.append("")
    return "\n".join(lines)


def main():
    p = argparse.ArgumentParser()
    for flag in (
        "index",
        "repo",
        "repo-short",
        "old-sha",
        "new-sha",
        "current-tag",
        "latest-tag",
        "output",
    ):
        p.add_argument(f"--{flag}", required=True)
    p.add_argument("--budget", type=int, required=True)
    args = p.parse_args()

    skills = parse_index(args.index)
    prepare(skills, args)

    header = build_header(args, skills)
    inlined = select(skills, args.budget - len(header))

    parts, omitted = [header], 0
    for skill in skills:
        if not skill["diffs"]:
            parts.append(f"### `{skill['local']}` — no changes\n")
            continue
        parts.append(f"### `{skill['local']}` ← upstream `{skill['upstream']}`\n")
        for entry in skill["diffs"]:
            if id(entry) in inlined:
                parts.append(entry["inline"])
            else:
                omitted += 1
                parts.append(entry["stub"])

    if omitted:
        parts.append(
            f"> {omitted} diff(s) omitted to stay under GitHub's issue-body limit."
            " Use the commands above to reproduce them.\n"
        )

    # The budget reserves headroom, but never emit a body GitHub will reject.
    # Drop whole trailing sections rather than cutting mid-markup, so the body
    # stays valid (an unclosed <details> would swallow the rest of the issue).
    dropped = 0
    while len(parts) > 1 and len("\n".join(parts)) > HARD_LIMIT - NOTICE_HEADROOM:
        parts.pop()
        dropped += 1
    if dropped:
        parts.append(
            f"> {dropped} further section(s) dropped to stay under GitHub's"
            " issue-body limit. Use the commands above to reproduce them.\n"
        )

    body = "\n".join(parts)

    with open(args.output, "w", encoding="utf-8") as fh:
        fh.write(body)

    print(
        f"Issue body: {len(body)} chars, {omitted} diff(s) omitted,"
        f" {dropped} section(s) dropped"
    )


if __name__ == "__main__":
    main()
