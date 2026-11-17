# Internet Computer (ICP) Skills

> **Under active development** — Skill files are being reviewed and signed off by DFINITY engineers. Content may change. Feedback and PRs are welcome.

**Agent-readable instructions for every IC need.**

Structured, agent-readable skill files for every Internet Computer capability. Your AI reads the skill. It builds correctly. No hallucinations.

---

## The Problem

AI agents building on the Internet Computer hallucinate canister IDs, use deprecated APIs, and miss critical pitfalls. Traditional documentation is written for humans to browse — not for agents to consume programmatically.

## The Solution

Each skill is a single markdown file containing everything an agent needs to build correctly:

```
skills/ckbtc/SKILL.md
skills/user-sign-in/SKILL.md
skills/stable-memory/SKILL.md
...
```

Every skill typically includes:

| Section | Purpose |
|---------|---------|
| **What This Is** | One paragraph. What the technology does. |
| **Prerequisites** | Exact library versions. `ic-cdk >= 0.19`, `@icp-sdk/auth >= 4.0.1`. |
| **Common Pitfalls** | Numbered pitfalls that prevent hallucinations. |
| **Implementation** | Tested, copy-paste-correct code blocks. |
| **Deploy & Test** | Step-by-step commands for local and mainnet. |
| **Verify It Works** | Concrete commands to confirm it works. |

Skills can include additional sections (Canister IDs, How It Works, etc.) and use whatever headings best fit their domain. The pitfalls section is the highest-value part — every pitfall documented is a hallucination prevented.

## Skills

All skills live in [`skills/*/SKILL.md`](skills/). Each skill is a self-contained markdown file with YAML frontmatter.

## Usage

### Quick start (any agent)

Paste this into your AI coding agent:

```text
Fetch https://skills.internetcomputer.org/llms.txt and follow its instructions when building on ICP
```

It starts using skills right away by fetching them on demand (nothing to install), and can set up how your project keeps using them going forward. If you choose to pin skills or enable auto-updates, the agent runs that setup for you.

### Install via CLI

Works with any agent that supports skills (Claude Code, Cursor, Windsurf, Copilot, and more):

```bash
npx skills add dfinity/icskills
```

Browse available skills, pick your agent, and install. See [skills.sh](https://skills.sh) for details.

### Manual

Fetch a single skill and place it wherever your agent reads instructions from:

```bash
curl -sL https://skills.internetcomputer.org/.well-known/agent-skills/ckbtc/SKILL.md
```

The files are plain markdown — paste into any system prompt, rules file, or context window.

## Programmatic Access

| Resource | URL | Description |
|----------|-----|-------------|
| Skills discovery | [`.well-known/agent-skills/index.json`](https://skills.internetcomputer.org/.well-known/agent-skills/index.json) | Machine-readable skill index ([Agent Skills Discovery RFC v0.2.0](https://github.com/cloudflare/agent-skills-discovery-rfc)). Also served at the older `/.well-known/skills/index.json`. |
| Single skill | `/.well-known/agent-skills/{name}/SKILL.md` | Raw markdown for one skill (every skill, whatever its index `type`) |
| Reference files | `/.well-known/agent-skills/{name}/references/{file}.md` | A skill's other files, one at a time |
| Download (zip) | `/.well-known/agent-skills/{name}.zip` | The whole skill folder (SKILL.md at the root), reproducible byte for byte |
| Skill index | [`llms.txt`](https://skills.internetcomputer.org/llms.txt) | Agent instructions with discovery links |
| Skill page | [`/skills/{name}/`](https://skills.internetcomputer.org/skills/ckbtc/) | Pre-rendered skill page for humans |

### The discovery index

Each entry follows the [Agent Skills Discovery RFC v0.2.0](https://github.com/cloudflare/agent-skills-discovery-rfc):

```jsonc
{
  "$schema": "https://schemas.agentskills.io/discovery/0.2.0/schema.json",
  "skills": [
    {
      "name": "vetkeys",
      "type": "archive",                 // "skill-md": SKILL.md only; "archive": SKILL.md + references/ or scripts/
      "description": "Build vetKeys cryptography …",
      "url": "https://…/.well-known/agent-skills/vetkeys.zip",
      "digest": "sha256:16ab1fde…",      // SHA-256 of the exact bytes at url
      "files": ["SKILL.md", "references/bls-signing.md", …],   // legacy, see below
      "hash": "sha256:…"                 // legacy, see below
    }
  ]
}
```

**`digest`** is the SHA-256 of the artifact at `url`: the SKILL.md for `skill-md`
entries, the zip for `archive` entries. Clients verify a download against it and can
compare it with a cached value to skip unchanged skills. Archives are built
reproducibly (fixed timestamps, sorted entries), so a digest changes only when the
skill's files do. `scripts/check-discovery.js` checks all of this against the built site.

**Legacy fields: `files` and `hash`.** These are the v0.1.0 index fields. The
[`autosync-ic-skills`](skills/autosync-ic-skills/SKILL.md) sync script is copied into
users' projects once and reads them on every session: `hash` (an aggregate over each
file's path and sha256) to decide what changed, and `files` to download each file from
`/.well-known/skills/{name}/`. Without them, an installed script replaces every skill
with an empty directory. v0.2.0 clients must ignore unrecognized fields, so carrying
them is conformant. Keep both fields, and the `/.well-known/skills/{name}/…` file URLs,
until installed scripts no longer read them.

## Evaluations

Each skill can have an evaluation file at `evaluations/<skill-name>.json` that tests whether agents produce correct output with the skill loaded. Evals compare agent output with and without the skill, using an LLM judge to score expected behaviors.

```bash
node scripts/evaluate-skills.js <skill-name>                    # All evals
node scripts/evaluate-skills.js <skill-name> --eval 2            # Single eval
node scripts/evaluate-skills.js <skill-name> --no-baseline       # Skip without-skill baseline
node scripts/evaluate-skills.js <skill-name> --triggers-only     # Trigger evals only
```

Results are saved to `evaluations/results/` (gitignored). See [CONTRIBUTING.md](CONTRIBUTING.md#4-add-evaluation-cases) for how to write eval cases and prompts.

## Community Skills

Third-party skills for the ICP ecosystem, maintained by their respective authors. These appear in the **Ecosystem** section on the skills site, clearly separated from DFINITY-maintained skills.

| Skill | Maintainer | Description |
|-------|------------|-------------|
| [Liquidium SDK Integration](https://github.com/Liquidium-Inc/liquidium-sdk/tree/main/skills/liquidium-sdk-integration) | Liquidium Inc | Authless instant-loan flow, market data, and profile-based lending via `@liquidium/client` on ICP. |

Community skills are not maintained by DFINITY. To propose a community skill, see [CONTRIBUTING.md](CONTRIBUTING.md#adding-a-community-skill).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or update skills.

**All PRs require repo admin approval.** One skill per PR. Code examples must be tested.

## Tech Stack

- **Site**: [Astro](https://astro.build/) — static site generator, zero JS by default. Interactive islands with [Preact](https://preactjs.com/) (~18kb gzipped total)
- **Hosting**: IC asset canister at [`skills.internetcomputer.org`](https://skills.internetcomputer.org)
- **Skills**: Plain markdown files in `skills/*/SKILL.md`
- **Validation**: [`skill-validator`](https://github.com/agent-ecosystem/skill-validator) for structure, links, content analysis, and contamination checks (`npm run validate`)
- **Evaluation**: Per-skill eval cases with LLM-as-judge scoring (`node scripts/evaluate-skills.js <skill>`)
- **Schema**: JSON Schema for frontmatter at `skills/skill.schema.json`
- **SEO**: Per-skill meta tags, JSON-LD (TechArticle), sitemap, canonical URLs
- **Skills Discovery**: `llms.txt`, `.well-known/agent-skills/` ([Agent Skills Discovery RFC v0.2.0](https://github.com/cloudflare/agent-skills-discovery-rfc))

## License

Apache-2.0
