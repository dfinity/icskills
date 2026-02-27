# IC Skills — Agent Instructions for Contributors

This repository contains agent-readable skill files for the Internet Computer. Each skill is a single markdown file at `skills/<skill-id>/SKILL.md`.

## Key Rules

- **Never edit `src/skills-data.js`** — it is auto-generated and gitignored
- **Never edit auto-generated files in `public/`** — `llms.txt`, `llms-full.txt`, `.well-known/agent.json`, `.well-known/ai-plugin.json` are all regenerated from SKILL.md sources. These files ARE committed to git (not gitignored) but must only be updated by running `npm run generate`. Note: `sitemap.xml` is generated at build time into `dist/` and is NOT committed.
- **Never edit `src/app.jsx` to add or update a skill** — the website auto-discovers skills from SKILL.md frontmatter. Only edit app.jsx for site-level UI changes.
- **One skill = one file** at `skills/<skill-id>/SKILL.md`. No nested directories, no images, no external dependencies within a skill.
- Skill IDs are **lowercase, hyphenated** (e.g., `ckbtc`, `https-outcalls`, `stable-memory`) and must match the directory name.

## Skill File Structure

Every SKILL.md has YAML frontmatter followed by a markdown body. See `skills/skill.schema.json` for the full schema and `skills/_template/SKILL.md.template` for a ready-to-copy skeleton.

### Required frontmatter fields
`id`, `name`, `category`, `description`, `version`, `endpoints`, `status`

### Recommended frontmatter fields
`dependencies`, `requires`, `tags` — validator warns if missing but does not block

### Required body sections (## headings)
1. `What This Is` — 2-3 sentences
2. `Prerequisites` — exact tools and versions
3. `Mistakes That Break Your Build` — numbered pitfalls (highest-value section)
4. `Implementation` — subsections per language (Motoko, Rust, JS)
5. `Deploy & Test` — step-by-step commands
6. `Verify It Works` — concrete verification commands with expected output

### Optional body sections
- `Canister IDs` — table of external canister principals (include when skill interacts with external canisters)
- `How It Works` — flow descriptions for non-trivial multi-step processes

## Build Commands

```bash
npm install          # Install dependencies
npm run validate     # Validate all skills (frontmatter, sections, deps)
npm run generate     # Regenerate all auto-generated files from SKILL.md sources
npm run dev          # Validate + generate + start Vite dev server
npm run build        # Validate + generate + production build
```

## Workflow

After modifying any SKILL.md file, ALWAYS:
1. **Bump the `version`** in frontmatter (patch for fixes, minor for new content, major for breaking changes). CI enforces this on PRs.
2. Run:
```bash
npm run validate     # Fix all errors before committing. Warnings are acceptable.
npm run generate     # Regenerate public/ files — commit these alongside your SKILL.md changes.
```
Both run in CI. Validate blocks deployment on errors. Generate output is checked for freshness — if `public/` files don't match what `npm run generate` produces, CI rejects the PR.

## Writing Guidelines

- **Write for agents, not humans.** Be explicit with canister IDs, function signatures, and error messages.
- **Pitfalls prevent hallucinations.** Every pitfall documented saves agents from generating broken code.
- **Code must be copy-paste correct.** Agents use code blocks directly — test everything.
- **Use semver strictly.** Patch for typos, minor for new sections, major for breaking API changes.
- **Keep code blocks annotated** with language identifiers (```motoko, ```rust, ```bash, etc.).

## Categories

DeFi, Tokens, Auth, Architecture, Integration, Governance, Frontend, Security, Infrastructure, Wallet

## Project Structure

```
skills/*/SKILL.md           # Skill source files (the content)
skills/skill.schema.json    # JSON Schema for frontmatter
skills/_template/            # Skeleton for new skills
scripts/lib/parse-skill.js  # Shared parsing utilities
scripts/generate-*.js       # Build-time generation scripts
scripts/validate-skills.js  # Structural validation (CI)
src/app.jsx                 # Website (auto-discovers skills from frontmatter)
public/                     # Auto-generated files (committed, but never edit manually)
```
