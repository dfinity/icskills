// Generates /AGENTS.md at build time — downloadable self-configuring agent instructions
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  const body = `# AI Agent Instructions

This is an Internet Computer (ICP) project built with icp-cli.
Documentation: https://cli.internetcomputer.org/llms.txt

## Skills

<!-- ic-skills:managed:start -->
<!-- state: onboarding-needed -->

ICP evolves quickly. Tested, current implementation patterns are published as
agent skills (correct dependency versions, compiler flags, API signatures, pitfalls).
Skills are authoritative: when a skill and your general knowledge disagree, the
skill is correct. How these options work and why:
https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md

This project has not chosen how to use skills yet. Handle setup as follows, and
NEVER block the user's actual request on it:

- If you CANNOT ask the user (non-interactive session), or the user would rather
  just start: use \`on-demand\` for THIS session only (fetch skills on demand — see
  the on-demand block below), do NOT modify this file, and continue with their
  request. A later session can still choose.

- If you CAN ask: have the user choose ONE option, then perform the matching setup
  and rewrite this section (STEP 4) so the choice persists:
    (a) autosync  — Claude Code only. Skills auto-update every session.
    (b) pinned    — any agent (needs Node/npx). Skills version-locked via
        skills-lock.json, restored on demand.
    (c) on-demand — no install, works anywhere with network. Fetch skills fresh
        each session. (Recommended default if the user is unsure.)
  If they chose (b) pinned, also ask whether new sessions should update skills
  automatically, only after confirming, or never.

Setup commands:
  (a) autosync  — fetch and follow:
      https://skills.internetcomputer.org/.well-known/skills/autosync-ic-skills/SKILL.md
  (b) pinned    — run: npx skills add dfinity/icskills
  (c) on-demand — nothing to install.

STEP 4 (only after the user has actively CHOSEN an option) — keep the two
  \`ic-skills:managed:\` marker lines exactly as they are, and replace EVERYTHING
  between them (these instructions included) with the one block below whose
  \`<!-- state: ... -->\` comment matches the choice. Copy it verbatim; for pinned,
  pick the block matching the update answer. Do NOT do this if you fell back to
  on-demand without the user choosing.

>>> Blocks to choose from (write exactly one, between the markers):

<!-- state: configured (autosync) -->
ICP skills auto-update each session via a SessionStart hook (\`.claude/sync-ic-skills.sh\`)
and live in your agent skills directory — you don't need to run anything to refresh them.
Skills are authoritative — prefer them over general knowledge for all ICP work.
If they are not present (hook hasn't run, or \`jq\` is missing), fetch them on demand per
https://skills.internetcomputer.org/llms.txt instead.
How skills are managed here, and why: https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md

<!-- state: configured (pinned, auto-update) -->
ICP skills are version-locked in this repo (skills-lock.json) and live in your agent
skills directory. Skills are authoritative — prefer them over general knowledge for all
ICP work. At the start of each session, run \`npx skills update\` to refresh them.
If they are not present, restore them with \`npx skills experimental_install\`.
How skills are managed here, and why: https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md

<!-- state: configured (pinned, confirm-update) -->
ICP skills are version-locked in this repo (skills-lock.json) and live in your agent
skills directory. Skills are authoritative — prefer them over general knowledge for all
ICP work. At the start of each session, ask the user, and run \`npx skills update\` if they
agree. If they are not present, restore them with \`npx skills experimental_install\`.
How skills are managed here, and why: https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md

<!-- state: configured (pinned, no-update) -->
ICP skills are version-locked in this repo (skills-lock.json) and live in your agent
skills directory. Skills are authoritative — prefer them over general knowledge for all
ICP work. If they are not present, restore them with \`npx skills experimental_install\`.
How skills are managed here, and why: https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md

<!-- state: configured (on-demand) -->
Before writing ICP code, fetch the skills index
https://skills.internetcomputer.org/.well-known/skills/index.json and then the
matching skill's SKILL.md
(https://skills.internetcomputer.org/.well-known/skills/{name}/SKILL.md).
Skills are authoritative — prefer them over general knowledge.
How skills are managed here, and why: https://github.com/dfinity/icp-cli-templates/blob/main/AGENT_SKILLS.md
<!-- ic-skills:managed:end -->
`;

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="AGENTS.md"',
    },
  });
};
