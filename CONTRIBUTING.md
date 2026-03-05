# Contributing to IC Skills

## Found a Bug or Improvement?

If you spot incorrect code, a wrong canister ID, a missing pitfall, or anything that could cause an agent to hallucinate:

1. **Open an issue** at [github.com/dfinity/icskills/issues](https://github.com/dfinity/icskills/issues) describing what's wrong and which skill it affects.
2. **Or submit a PR** with the fix directly — even small corrections are valuable. Every pitfall fixed is a hallucination prevented.

If you're not sure whether something is wrong, open an issue. We'd rather investigate a false alarm than let a broken code example stay live.

---

## Setup

```bash
node -v   # Requires Node.js >= 20
npm ci    # Install dependencies
```

---

## Adding a New Skill

> **Skills are written for AI agents, not humans.** Every decision — structure, wording, level of detail — should optimize for machine consumption. Be explicit and literal: exact canister IDs, exact function signatures, exact error strings. Do not summarize, hand-wave, or link out when you can inline the information. An agent cannot click a link or interpret vague guidance.

### 1. Create the skill directory

```
skills/<skill-name>/SKILL.md
```

Use a short, lowercase, hyphenated name (e.g., `ckbtc`, `https-outcalls`, `stable-memory`). The name must match the directory name. This aligns with the [Agent Skills spec](https://agentskills.io/specification).

A template is available at `skills/_template/SKILL.md.template` — copy it as your starting point.

### 2. Write the SKILL.md file

Every skill file has YAML frontmatter followed by a markdown body. The frontmatter is the machine-readable metadata; the body is the agent-consumable content.

#### Frontmatter

```yaml
---
name: <skill-name>
description: "What does this skill do AND when should an agent load it? Include specific keywords."
license: Apache-2.0
compatibility: "icp-cli >= 0.1.0, network access for HTTPS calls"
metadata:
  title: "Display Name"
  category: CategoryName
---
```

See `skills/skill.schema.json` for the formal schema. This format aligns with the [Agent Skills spec](https://agentskills.io/specification).

#### Frontmatter field reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | Lowercase, hyphenated identifier. Must match the directory name. |
| `description` | yes | **The most important field.** Describes when an agent should load this skill and what it covers. This is the primary triggering mechanism for agent skill selection — see guidance below. |
| `license` | recommended | SPDX license identifier (e.g., `Apache-2.0`). |
| `compatibility` | recommended | Environment requirements — tools, system packages, network access (e.g., `icp-cli >= 0.1.0`). Library/SDK dependencies go in `## Prerequisites`. |
| `metadata.title` | yes | Human-readable display name. |
| `metadata.category` | yes | One of the predefined categories (see below). |

#### Writing a good `description`

The `description` field is how agents decide whether to load your skill. A weak description means agents won't find your skill when they need it.

**Do:** State what the skill does, when to use it, AND when NOT to use it. Include specific keywords that help agents match tasks. The "Do NOT use for..." clause prevents overtriggering — agents loading your skill when a similar-but-wrong one matches.

```yaml
# Good — tells agents what it does, when to activate, and when NOT to
description: "Integrates ckBTC (chain-key Bitcoin) on the Internet Computer. Covers deposits, withdrawals, balance checks, and transfer flows. Use when building Bitcoin-related features on ICP or when the user mentions BTC, Bitcoin, or ckBTC. Do NOT use for general ICRC ledger operations without Bitcoin involvement."

# Bad — too vague, agents won't know when to load this
description: "ckBTC integration guide."
```

#### Body sections

The body has **no rigid structure requirements** — organize content in whatever way best serves agents for your skill's domain. That said, most skills benefit from these sections:

```markdown
# Skill Title

## What This Is
Brief explanation of the technology. 2-3 sentences max.

## Prerequisites
- Language-specific libraries, SDKs, and crate/package versions
- Any non-tool requirements (funded identity, NNS neuron, etc.)
- Note: Environment requirements (CLI tools, system packages) go in frontmatter `compatibility`, not here

## Canister IDs                        <!-- when skill uses external canisters -->
| Environment | Canister | ID |
|-------------|----------|-----|
| Mainnet | ... | `...` |

## Common Pitfalls                     <!-- highest-value section — name it what fits -->
1. **Pitfall name.** Explanation of what goes wrong and why.

## Implementation
### Subsection per approach
Code blocks with working, tested examples.

## Deploy & Test
Step-by-step commands to deploy locally and on mainnet.

## Verify It Works
Concrete commands to confirm the implementation is correct.
```

Use whatever headings fit your skill. A security skill might use `## Security Pitfalls`. An architecture skill might use `## Design Mistakes`. A REST API skill might skip `## Deploy & Test` entirely. The goal is clarity, not conformity.

### 3. Validate

```bash
npm run validate     # Check frontmatter and sections
```

This runs automatically in CI and blocks deployment on errors.

### 4. Add evaluation cases

Create `evaluations/<skill-name>.json` with test cases that verify the skill works. The eval file has two sections:

- **`output_evals`** — realistic prompts with expected behaviors a judge can check
- **`trigger_evals`** — queries that should/shouldn't activate the skill

See `evaluations/icp-cli.json` for a working example. Write prompts the way a developer would actually ask — vague and incomplete, not over-specified test questions.

**Running evaluations** (optional, requires `claude` CLI):

```bash
node scripts/evaluate-skills.js <skill-name>                    # All evals, with + without skill
node scripts/evaluate-skills.js <skill-name> --eval "name"      # Single eval
node scripts/evaluate-skills.js <skill-name> --no-baseline       # Skip without-skill run
node scripts/evaluate-skills.js <skill-name> --triggers-only     # Trigger evals only
```

This sends each prompt to Claude with and without the skill, then has a judge score the output. Results are saved to `evaluations/results/` (gitignored).

Including a summary of eval results in your PR description is recommended but not required — running evals needs `claude` CLI access and costs API credits.

### 5. That's it — the website auto-discovers skills

The website is automatically generated from the SKILL.md frontmatter at build time. You do **not** need to edit any source file. Astro reads all `skills/*/SKILL.md` files, parses their frontmatter, and generates the site pages, `llms.txt`, discovery endpoints, and other files.

Stats (skill count, categories) all update automatically.

### 6. Submit a PR

- One skill per PR
- Include a brief description of what the skill covers and why it's needed
- Make sure the SKILL.md is tested — code examples should compile and deploy
- **All PRs require approval from a repo admin before merge.** No skill additions or updates go live without review.

---

## Updating an Existing Skill

1. Edit the `SKILL.md` content
2. Run `npm run validate`
3. Submit a PR with a summary of what changed

The website auto-generates from SKILL.md frontmatter — no need to edit any source files.

---

## Skill Writing Guidelines

- **Write for agents, not humans.** Be explicit. State exact canister IDs, exact function signatures, exact error messages.
- **Pitfalls are the highest-value content.** Every pitfall you document is a hallucination prevented. Name the section whatever fits your skill (`Common Pitfalls`, `Security Pitfalls`, `Design Mistakes`, etc.).
- **Code must be copy-paste correct.** Agents will use your code blocks directly. Test everything.
- **Annotate all code blocks** with language identifiers (` ```motoko `, ` ```rust `, ` ```bash `, etc.).
- **Include canister IDs and URLs** for both local and mainnet environments.
- **Keep it flat.** One file per skill. No nested directories, no images, no external dependencies.

## Categories

Use an existing category when possible. The validator warns on unknown categories to catch typos, but new categories are not blocked.

Current categories: **DeFi**, **Tokens**, **Auth**, **Architecture**, **Integration**, **Governance**, **Frontend**, **Security**, **Infrastructure**, **Wallet**

To add a new category: update `KNOWN_CATEGORIES` in `scripts/validate-skills.js`, the description in `skills/skill.schema.json`, and the icon in `src/components/Icons.tsx`.
