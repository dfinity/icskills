# Contributing to IC Skills

## Found a Bug or Improvement?

If you spot incorrect code, a wrong canister ID, a missing pitfall, or anything that could cause an agent to hallucinate:

1. **Open an issue** at [github.com/dfinity/icskills/issues](https://github.com/dfinity/icskills/issues) describing what's wrong and which skill it affects.
2. **Or submit a PR** with the fix directly — even small corrections are valuable. Every pitfall fixed is a hallucination prevented.

If you're not sure whether something is wrong, open an issue. We'd rather investigate a false alarm than let a broken code example stay live.

---

## Setup

```bash
node -v   # Requires Node.js >= 22
npm ci    # Install dependencies

# Install skill-validator (required for npm run validate)
brew tap agent-ecosystem/homebrew-tap && brew install skill-validator
# or: go install github.com/agent-ecosystem/skill-validator/cmd/skill-validator@latest
```

---

## Adding a New Skill

> **Skills are written for AI agents, not humans.** Every decision — structure, wording, level of detail — should optimize for machine consumption. Be explicit and literal: exact canister IDs, exact function signatures, exact error strings. Do not summarize, hand-wave, or link out when you can inline the information. An agent cannot click a link or interpret vague guidance.

### 1. Draft the skill with skill-creator

Use the [Anthropic `skill-creator` skill](https://github.com/anthropics/skills/tree/main/skills/skill-creator) to draft your SKILL.md. It guides you through capturing intent, writing content, running test prompts, and iterating on quality — including a description optimization loop that generates 20 trigger queries and scores them automatically.

To use it in Claude Code, load the skill from the URL above and follow the interview prompts. skill-creator handles the general Agent Skills spec fields (`name`, `description`, `license`, `compatibility`) and the body content.

**IC-specific additions required after drafting:** skill-creator does not know about the IC Skills schema. After it produces a draft, manually add the `metadata:` block — these fields are required and will block CI if missing:

```yaml
metadata:
  title: "Display Name"    # human-readable name for the site
  category: CategoryName   # see categories list below
```

`npm run validate` will catch any missing required fields. See `skills/skill.schema.json` for the full schema.

### 2. Create the skill directory

```
skills/<skill-name>/SKILL.md
skills/<skill-name>/references/   # optional — for large reference material
```

Use a short, lowercase, hyphenated name (e.g., `ckbtc`, `https-outcalls`, `stable-memory`). The name must match the directory name. This aligns with the [Agent Skills spec](https://agentskills.io/specification).

Keep the main SKILL.md under 500 lines. Move detailed reference material (migration guides, config examples) to `references/*.md` and reference them from SKILL.md. See `skills/icp-cli/` for an example.

### 3. Write the SKILL.md file

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

### 4. Validate

```bash
npm run validate     # Runs skill-validator + evals file check
```

This runs automatically in CI and blocks deployment on errors. Under the hood it runs [`skill-validator check`](https://github.com/agent-ecosystem/skill-validator) (structure, links, content analysis, contamination detection) plus a project-specific check for evaluation files.

### 5. Run LLM quality scoring (recommended)

Before submitting a PR, run LLM scoring locally to check your skill's quality:

```bash
skill-validator score evaluate --provider claude-cli skills/<skill-name>
```

This uses the locally authenticated `claude` CLI — no API key needed. Low novelty scores indicate the skill may restate common knowledge rather than providing genuinely new information. See the [skill-validator docs](https://github.com/agent-ecosystem/skill-validator#score-evaluate) for interpreting scores.

### 6. Add evaluation cases

Create `evaluations/<skill-name>.json` with test cases that verify the skill works. The eval file has two sections:

- **`output_evals`** — realistic prompts with expected behaviors a judge can check
- **`trigger_evals`** — queries that should/shouldn't activate the skill

See `evaluations/icp-cli.json` for a working example. Aim for every pitfall in your skill to have at least one eval covering it — pitfalls are where agents hallucinate most.

#### Writing eval prompts

Eval prompts run through the `claude` CLI with a 120-second timeout. Open-ended prompts cause the model to generate long responses (full tutorials, backend code, deploy steps) that exceed this limit. Focus each prompt on one thing:

- **Scope the response explicitly** — say what you want ("just the function", "just the YAML snippet") and what to exclude ("no backend code, no deploy steps")
- **Ask for one thing** — "What URL should I use for the local identityProvider?" runs faster than "How do I set up II locally?"
- **Match expected behaviors to the prompt** — don't expect the model to volunteer information the prompt doesn't ask for. If you ask about local URLs, don't fail the eval for missing the mainnet URL
- **Test before committing** — run the eval and verify it completes within the timeout

```
# Bad — open-ended, will generate full tutorial and likely timeout
"Show me how to add Internet Identity login to my Vite frontend app."

# Good — scoped, excludes irrelevant content
"Show me just the JavaScript module that initializes AuthClient and checks
if the user is already authenticated. Keep it minimal — no backend code,
no icp.yaml, no deploy steps."
```

**Running evaluations** (requires `claude` CLI):

```bash
node scripts/evaluate-skills.js <skill-name>                    # All evals, with + without skill
node scripts/evaluate-skills.js <skill-name> --list              # List available evals
node scripts/evaluate-skills.js <skill-name> --eval 2            # Single eval by index
node scripts/evaluate-skills.js <skill-name> --eval 2 --no-baseline  # Single eval, skill only
node scripts/evaluate-skills.js <skill-name> --no-baseline       # Skip without-skill run
node scripts/evaluate-skills.js <skill-name> --triggers-only     # Trigger evals only
```

This sends each prompt to Claude with and without the skill, then has a judge score the output. Results are saved to `evaluations/results/` (gitignored).

**Eval results are required in the PR for new skills** — see [Step 8](#8-submit-a-pr) for the required format.

> **Two-phase eval workflow:** skill-creator has its own built-in eval loop (workspace-based, browser viewer, iterative) that's useful during drafting. That is separate from the `evaluations/<skill-name>.json` file you commit here. Use skill-creator's loop to iterate on quality while drafting; the committed eval file is the PR requirement. If you ran skill-creator's description optimization, its 20 trigger queries can seed your `trigger_evals` — convert them to [IC eval format](evaluations/icp-cli.json) rather than starting from scratch.

### 7. That's it — the website auto-discovers skills

The website is automatically generated from the SKILL.md frontmatter at build time. You do **not** need to edit any source file. Astro reads all `skills/*/SKILL.md` files, parses their frontmatter, and generates the site pages, `llms.txt`, discovery endpoints, and other files.

Stats (skill count, categories) all update automatically.

### 8. Submit a PR

- One skill per PR
- Include a brief description of what the skill covers and why it's needed
- Include LLM scoring output in your PR description if you ran it locally (see step 4)
- Make sure the SKILL.md is tested — code examples should compile and deploy
- **Eval results are required.** Run the full evaluation suite locally and paste the results into the PR description. Both output evals and trigger evals must be included. PRs without eval results will not be accepted.
- **Collapse the results** using a `<details>` block to keep the PR description readable:

  ````markdown
  <details>
  <summary>Evaluation results</summary>

  ```
  [paste eval output here]
  ```

  </details>
  ````

- **All PRs require approval from a repo admin before merge.** No skill additions or updates go live without review.

---

## Updating an Existing Skill

For non-trivial improvements (content quality, description accuracy, new pitfalls), use the [Anthropic `skill-creator` skill](https://github.com/anthropics/skills/tree/main/skills/skill-creator) — it supports editing and optimizing existing skills, not just creating new ones. Load the skill and point it at the existing SKILL.md; it will go straight to the eval/iterate loop.

For small fixes (typos, canister ID updates, corrected code):

1. Edit the `SKILL.md` content
2. Run `npm run validate`
3. Optionally run LLM scoring (see step 5 above)
4. If you added new evaluation cases, run those evals locally and include the results in the PR
5. Submit a PR with a summary of what changed

**Eval results for skill improvements:** If you added new eval cases, you only need to provide results for those new cases — not the full suite. Both the with-skill and baseline (without-skill) results must be included. Collapse them in the PR description using a `<details>` block (see [Submit a PR](#8-submit-a-pr) above).

The website auto-generates from SKILL.md frontmatter — no need to edit any source files.

---

## Upstream-tracked Skills

Some skills mirror content from external upstream repositories (currently `caffeinelabs/motoko` and `caffeinelabs/mops`). These skills track a specific release tag and are updated manually when a new release lands.

### How it works

A weekly GitHub Actions workflow checks for new releases on each tracked upstream. When it finds one, it opens a GitHub issue labelled `upstream-motoko` or `upstream-mops` with:
- The old → new release tag in the title
- A diff of the upstream file against our current version

**There is always at most one open sync issue per upstream repo.** If a newer release comes out before the issue is resolved, the workflow closes the stale issue (with a "Superseded" comment) and opens a fresh one for the latest release.

### Handling a sync issue

1. Find the open issue labelled `upstream-motoko` or `upstream-mops`
2. Note the target release tag in the title (always the *latest* release — skip any intermediate ones)
3. Re-run the diff locally against the current files — the issue body diff may be stale if other changes landed on `main` since the issue was opened:
   ```bash
   curl -s "https://raw.githubusercontent.com/<org>/<repo>/<commit>/<path>" > /tmp/upstream.md
   diff skills/<skill-name>/SKILL.md /tmp/upstream.md
   ```
4. Apply changes following the [Upstream Sync Strategy](.claude/CLAUDE.md#upstream-sync-strategy) in `.claude/CLAUDE.md` — in particular, preserve any sections listed as "owned by icskills" in the skill's upstream comment block
5. Run `npm run validate`
6. Open a PR that closes the issue with `Closes #<n>` in the PR body

The full sync checklist (version numbers, evals, compatibility, owned sections, etc.) is in `.claude/CLAUDE.md`.

---

## Skill Writing Guidelines

- **Write for agents, not humans.** Be explicit. State exact canister IDs, exact function signatures, exact error messages.
- **Pitfalls are the highest-value content.** Every pitfall you document is a hallucination prevented. Name the section whatever fits your skill (`Common Pitfalls`, `Security Pitfalls`, `Design Mistakes`, etc.).
- **Code must be copy-paste correct.** Agents will use your code blocks directly. Test everything.
- **Annotate all code blocks** with language identifiers (` ```motoko `, ` ```rust `, ` ```bash `, etc.).
- **Include canister IDs and URLs** for both local and mainnet environments.
- **Keep it flat.** One file per skill. No nested directories, no images, no external dependencies.
- **Don't duplicate other skills.** If another skill covers a pattern in depth (e.g., `canister-security` for access control and async safety), reference it by name in your pitfalls instead of inlining the pattern. This keeps maintenance centralized and ensures agents get the authoritative version. The `description` field is the primary mechanism agents use to discover related skills — cross-references in pitfalls serve as secondary hints.

## Categories

Use an existing category when possible. The validator warns on unknown categories to catch typos, but new categories are not blocked.

Current categories: **Auth**, **Core**, **DeFi**, **Frontend**, **Governance**, **Infrastructure**, **Integration**, **Motoko**, **Security**

To add a new category: update the description string in `skills/skill.schema.json`, the `KNOWN_CATEGORIES` array in `scripts/check-project.js`, and the `CATEGORY_ORDER` array in `src/lib/skills.ts`.
