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

### 1. Create the skill directory

```
skills/<skill-id>/SKILL.md
```

Use a short, lowercase, hyphenated ID (e.g., `ckbtc`, `https-outcalls`, `stable-memory`). The ID must match the directory name.

A template is available at `skills/_template/SKILL.md.template` — copy it as your starting point.

### 2. Write the SKILL.md file

Every skill file has YAML frontmatter followed by a markdown body. The frontmatter is the machine-readable metadata; the body is the agent-consumable content.

#### Frontmatter

```yaml
---
id: <skill-id>
name: "Display Name"
category: CategoryName
description: "One sentence. When should an agent load this skill? What does it cover?"
endpoints: 5
version: 1.0.0
status: stable
dependencies: [dep1, dep2]
requires: [icp-cli >= 0.1.0, other-tool >= version]
tags: [keyword1, keyword2, keyword3]
---
```

See `skills/skill.schema.json` for the formal schema.

#### Frontmatter field reference

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Lowercase, hyphenated identifier. Must match the directory name. |
| `name` | yes | Human-readable display name. |
| `category` | yes | One of the predefined categories (see below). |
| `description` | yes | One sentence. Describes when an agent should load this skill. |
| `endpoints` | yes | Number of distinct canister methods or external API operations documented in the Implementation section. |
| `version` | yes | Semantic version (`major.minor.patch`). |
| `status` | yes | `stable` (production-ready) or `beta` (API may change). |
| `dependencies` | recommended | Array of skill IDs this skill depends on. Use `[]` if none. |
| `requires` | recommended | Tool/package dependencies with version constraints (e.g., `icp-cli >= 0.1.0`). |
| `tags` | recommended | Keywords for agent discovery. Lowercase, hyphenated. |

#### Body sections

```markdown
# Skill Title

## What This Is
Brief explanation of the technology. 2-3 sentences max.

## Prerequisites
- Bullet list of required tools, packages, versions

## Canister IDs                        <!-- optional: include when skill uses external canisters -->
| Environment | Canister | ID |
|-------------|----------|-----|
| Mainnet | ... | `...` |

## How It Works                        <!-- optional: for non-trivial multi-step flows -->
### Flow Name
1. Step one...

## Mistakes That Break Your Build      <!-- HIGHEST-VALUE SECTION -->
1. **Pitfall name.** Explanation of what goes wrong and why.

## Implementation
### Subsection per approach
Code blocks with working, tested examples.

## Deploy & Test
Step-by-step commands to deploy locally and on mainnet.

## Verify It Works
Concrete commands to confirm the implementation is correct.
```

### 3. Validate and regenerate

```bash
npm run validate     # Check frontmatter, sections, dependency graph
npm run generate     # Regenerate public/ files (llms.txt, agent.json, etc.)
```

Both commands run automatically in CI. The deploy pipeline verifies that committed files in `public/` match what `npm run generate` produces — if they're out of date, CI will reject the PR.

**Commit the updated `public/` files** alongside your SKILL.md changes.

### 4. That's it — the website auto-discovers skills

The website is automatically generated from the SKILL.md frontmatter at build time. You do **not** need to edit `app.jsx` or any other source file. The build script (`scripts/generate-skills.js`) scans all `skills/*/SKILL.md` files, parses their frontmatter, and generates the data the site uses.

Stats (skill count, operations, categories) all update automatically.

### 5. Submit a PR

- One skill per PR
- Include a brief description of what the skill covers and why it's needed
- Make sure the SKILL.md is tested — code examples should compile and deploy
- **All PRs require approval from a repo admin before merge.** No skill additions or updates go live without review.

---

## Updating an Existing Skill

### When to bump the version

| Change | Version bump | Example |
|--------|-------------|---------|
| Fix a typo, clarify wording | Patch `x.x.+1` | 1.0.0 → 1.0.1 |
| Add a new section, update code examples | Minor `x.+1.0` | 1.0.0 → 1.1.0 |
| Rewrite for breaking API changes (e.g., mo:base → mo:core) | Major `+1.0.0` | 1.0.0 → 2.0.0 |

### Steps

1. Edit the `SKILL.md` content
2. Bump the `version` in the frontmatter
3. Run `npm run validate && npm run generate` and commit the updated `public/` files
4. Submit a PR with a summary of what changed

The website auto-generates from SKILL.md frontmatter — no need to edit any source files.

---

## Skill Writing Guidelines

- **Write for agents, not humans.** Be explicit. State exact canister IDs, exact function signatures, exact error messages.
- **Pitfalls are the highest-value section.** Every pitfall you document is a hallucination prevented.
- **Code must be copy-paste correct.** Agents will use your code blocks directly. Test everything.
- **Annotate all code blocks** with language identifiers (` ```motoko `, ` ```rust `, ` ```bash `, etc.).
- **Include canister IDs and URLs** for both local and mainnet environments.
- **Keep it flat.** One file per skill. No nested directories, no images, no external dependencies.
- **Use semver strictly.** Agents and tooling rely on version numbers to detect stale skills.

## Categories

Current categories used on the site:

| Category | Examples |
|----------|---------|
| DeFi | ckBTC |
| Tokens | ICRC Ledger |
| Auth | Internet Identity |
| Architecture | Multi-Canister, Stable Memory |
| Integration | HTTPS Outcalls, EVM RPC |
| Governance | SNS Launch |
| Frontend | Asset Canister |
| Security | vetKD, Certified Variables |
| Infrastructure | Cycles Wallet |
