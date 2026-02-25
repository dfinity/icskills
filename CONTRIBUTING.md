# Contributing to IC Skills

## Adding a New Skill

### 1. Create the skill directory

```
skills/<skill-id>/SKILL.md
```

Use a short, lowercase, hyphenated ID (e.g., `ckbtc`, `https-outcalls`, `stable-memory`).

### 2. Write the SKILL.md file

Every skill file follows this structure:

```markdown
---
name: <skill-id>
description: One sentence. When should an agent load this skill? What does it cover?
---

# Skill Title
> version: 1.0.0 | requires: [dfx >= 0.24.0, other deps]

## What This Is
Brief explanation of the technology. 2-3 sentences max.

## Prerequisites
- Bullet list of required tools, packages, versions

## Mistakes That Break Your Build
Numbered list of critical pitfalls. These are the most important part of the skill —
they prevent agents from hallucinating incorrect patterns.

1. **Pitfall name.** Explanation of what goes wrong and why.

## Implementation
### Subsection per approach
Code blocks with working, tested examples.

## Deploy & Test
Step-by-step commands to deploy locally and on mainnet.

## Verify It Works
Concrete commands to confirm the implementation is correct.
```

### 3. Register the skill on the website

Add an entry to the `SKILLS` array in `src/app.jsx`:

```javascript
{
  id: "your-skill-id",        // matches the directory name
  name: "Human-Readable Name",
  category: "Category",       // DeFi, Auth, Architecture, Tokens, etc.
  description: "One-line description for the card.",
  endpoints: 6,               // number of operations/endpoints covered
  lastUpdated: "2026-02-24",  // date of last content change
  version: "1.0.0",           // semver, matches the SKILL.md header
  status: "stable",           // stable | beta | experimental
  dependencies: [],            // IDs of other skills this depends on
}
```

### 4. Submit a PR

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
2. Bump the `version` in the SKILL.md header line: `> version: X.Y.Z | requires: [...]`
3. Update the matching entry in `src/app.jsx`:
   - Set `version` to the new value
   - Set `lastUpdated` to today's date
   - Update `endpoints` count if it changed
4. Submit a PR with a summary of what changed

---

## Skill Writing Guidelines

- **Write for agents, not humans.** Be explicit. State exact canister IDs, exact function signatures, exact error messages.
- **Pitfalls are the highest-value section.** Every pitfall you document is a hallucination prevented.
- **Code must be copy-paste correct.** Agents will use your code blocks directly. Test everything.
- **Include canister IDs and URLs** for both local and mainnet environments.
- **Keep it flat.** One file per skill. No nested directories, no images, no external dependencies.
- **Use semver strictly.** Agents and tooling rely on version numbers to detect stale skills.

## Categories

Current categories used on the site:

| Category | Examples |
|----------|---------|
| DeFi | ckBTC, ICRC Ledger |
| Auth | Internet Identity |
| Architecture | Multi-Canister, Stable Memory |
| Tokens | ICRC Ledger |
| Integration | HTTPS Outcalls, EVM RPC |
| Governance | SNS Launch |
| Frontend | Asset Canister |
| Crypto | vetKD |
| DevOps | Cycles & Wallet |
| Data | Certified Variables |
