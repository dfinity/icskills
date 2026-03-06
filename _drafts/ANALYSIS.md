# IC Skills: Analysis & Recommendations

**Authors**: Staff AI Engineer, Staff Prompt Engineer, Staff IC Core Engineer, Staff DevRel Engineer
**Date**: February 2026
**Status**: Draft for internal review

---

## Executive Summary

We audited all 13 existing IC Skills (plus 3 in-flight PRs), benchmarked them against Anthropic's official skill authoring best practices, two community skill repositories, and the full breadth of the IC developer ecosystem. Our findings:

1. **~40% of existing skill content is documentation repetition** that a coding assistant could derive from public docs or `icp --help`. This wastes context window tokens without improving agent output quality.
2. **The highest-value content — pitfalls — is excellent** but buried inside skills organized by IC subsystem rather than developer task.
3. **Critical gaps exist** in security, testing, upgrades, wallet/signer integration, and modern tooling (`@icp-sdk/core`, EOP, PocketIC). These are exactly the areas where agents produce the most dangerous code.
4. **The current one-file-per-skill structure breaks down** at scale. Five skills exceed the 500-line recommended maximum. Progressive disclosure via supplementary files is needed.
5. **Skills should be reorganized around developer tasks** ("How do I secure my canister?") rather than IC features ("Here's the certified-variables API").
6. **Clear acceptance criteria are needed** to prevent the catalog from growing into a documentation mirror. Every skill must pass the "Would a coding assistant get this wrong?" test.

We propose a restructured catalog of **16 skills** organized in three tiers, with clear policies on when to include code, reference external docs, reference libraries, and when to accept new skills.

---

## 1. Methodology

### Sources Analyzed

| Source | What We Extracted |
|--------|-------------------|
| **Anthropic Agent Skills Best Practices** (platform.claude.com) | Content principles, structural guidelines, anti-patterns, evaluation methodology |
| **dfinity/icskills** (this repo, 13 skills + 3 PRs) | Line counts, section coverage, dependency graph, content quality per skill |
| **jorgenbuilder/icp-skills** (community, 3 skills) | Alternative structure, icp-cli skill content, progressive disclosure approach |
| **leonardomso/rust-skills** (179 rules) | Monolith skill approach with thematic categories |
| **Agent Skills Spec** (agentskills.io) | Frontmatter schema, discovery protocol, naming conventions |
| **IC Developer Ecosystem** (docs, forum, security guides, GitHub) | Pain points, common bugs, tooling landscape, ecosystem breadth |
| **icp-cli documentation** (local repo) | Accurate CLI command reference, concepts (environments, recipes, networks) |
| **Issue #45** (frontmatter alignment) | Agent Skills spec compliance, proposed frontmatter restructuring |

### Evaluation Criteria

Every skill was assessed against one question: **"Would a capable coding assistant produce broken, insecure, or suboptimal code without this specific content?"** Content that passes this test stays. Content that doesn't is flagged for removal or demotion to a reference file.

---

## 2. Current State Assessment

### 2.1 Skill Inventory

| Skill | Lines | Category | Dependencies | Code Blocks | Over 500 Lines? |
|-------|-------|----------|--------------|-------------|-----------------|
| asset-canister | 312 | Frontend | — | 8 | No |
| certified-variables | 487 | Security | — | 12 | No |
| ckbtc | 778 | DeFi | icrc-ledger, wallet | 18 | **Yes** |
| evm-rpc | 835 | Integration | https-outcalls | 20 | **Yes** |
| https-outcalls | 448 | Integration | — | 8 | No |
| ic-dashboard | 203 | Integration | — | 4 | No |
| icrc-ledger | 522 | Tokens | — | 6 | **Yes** |
| internet-identity | 367 | Auth | asset-canister | 6 | No |
| multi-canister | 978 | Architecture | stable-memory | 20 | **Yes** |
| sns-launch | 414 | Governance | icrc-ledger, multi-canister | 6 | No |
| stable-memory | 370 | Architecture | — | 6 | No |
| vetkd | 629 | Security | internet-identity | 16 | **Yes** |
| wallet | 356 | Infrastructure | — | 6 | No |

**Total**: 6,699 lines across 13 skills. Five skills exceed the 500-line recommendation.

### 2.2 Content Quality Assessment

#### What Works Well

- **"Mistakes That Break Your Build" sections are universally strong.** These are the single most valuable content type across all skills. They directly prevent agent hallucinations.
- **Dual Motoko/Rust implementations** ensure agents generate correct code regardless of the developer's language choice.
- **Canister IDs tables** prevent a class of bug that would otherwise be very common (wrong principal for mainnet vs testnet).
- **Consistent structure** (schema-enforced frontmatter, required sections) makes every skill parseable with the same expectations.

#### What Needs Improvement

- **Boilerplate API code inflates line counts.** Skills like `ckbtc` (778 lines) and `evm-rpc` (835 lines) contain large code blocks that are essentially "call this function with these parameters." A coding assistant can generate this from Candid interfaces. Example: the `evm-rpc` skill contains 20 code blocks, many showing slight variations of the same RPC call pattern.
- **Cross-cutting pitfalls are duplicated.** "Capture caller before await" appears in `multi-canister`, `internet-identity`, and `icrc-ledger`. "Attach cycles" appears in `https-outcalls`, `evm-rpc`, `ckbtc`, and `wallet`. Each repetition costs tokens without adding information.
- **Organization by IC subsystem creates awkward boundaries.** A developer building a DeFi app needs patterns from `icrc-ledger` + `ckbtc` + `multi-canister` + security patterns that don't exist yet. The agent must discover and load 4+ skills to assemble one workflow.
- **No progressive disclosure.** Every skill is a single file. When `multi-canister` is loaded at 978 lines, it competes with conversation history for context window space. The Anthropic best practices recommend splitting at 500 lines.

#### Per-Skill Verdict

| Skill | Value | Action | Rationale |
|-------|-------|--------|-----------|
| multi-canister | **High** | Keep + split | Non-obvious atomicity semantics, saga patterns. But 978 lines — split into SKILL.md + reference files |
| certified-variables | **High** | Keep | Merkle proofs, certification flow — cannot be derived from docs |
| stable-memory | **High** | Rewrite | Content is correct but covers the **old** persistence model. EOP (Enhanced Orthogonal Persistence) is now production-default in Motoko. Needs fundamental rewrite |
| https-outcalls | **High** | Keep | Transform determinism, N×POST — well-calibrated at 448 lines |
| internet-identity | **Medium-High** | Keep | Auth integration pitfalls are real. Trim minor boilerplate |
| vetkd | **Medium-High** | Keep + trim | IBE pattern is novel. But 629 lines — move code examples to reference file |
| ckbtc | **Medium** | Trim heavily | Subaccount derivation + pitfalls are valuable. ~60% is mechanical API code |
| evm-rpc | **Medium** | Trim heavily | Multi-provider consensus is non-obvious. ~50% is repetitive call examples |
| icrc-ledger | **Medium** | Trim | DeFi-safety pitfalls are the real value. Standard API usage is removable |
| asset-canister | **Medium** | Trim | `.ic-assets.json5` config and auth model matter. Deployment steps don't |
| sns-launch | **Medium-Low** | Trim | Tokenomics guidance and testflight pitfall are useful. YAML config examples aren't |
| wallet | **Low** | Remove — see §6.9 | Mostly CLI reference that duplicates `icp --help` output |
| ic-dashboard | **Low** | Remove — see §6.9 | Pure API reference with no non-obvious patterns |

### 2.3 Structural Issues

**Dependency graph is shallow.** Only 4 of 13 skills declare dependencies. Yet in practice, almost every skill implicitly depends on understanding cycles management, CLI usage, and security patterns. The dependency model doesn't capture "every skill assumes you know how to deploy" — that's currently handled by each skill repeating Deploy & Test boilerplate.

**No cross-referencing in body text.** Skills don't link to each other within their content. When `multi-canister` discusses the async atomicity problem, it doesn't point to a security skill for the TOCTOU implications — because no security skill exists.

**Category distribution is uneven.** Security (2), Architecture (2), Integration (3), but no Infrastructure skill for the CLI, no Testing skill, and no Wallet/Signer skill.

### 2.4 In-Flight Contributions

Three open PRs add or improve skills. Here is how they relate to the proposed restructuring:

#### PR #16 — `oisy-wallet-signer` (new skill, +476 lines)

Adds a skill for the OISY Wallet Signer library. This directly addresses our identified gap in wallet/signer integration (see §4.1). **However**, this PR was created before the proposed restructuring. Under the new catalog, this content belongs in the broader **`wallet-integration`** skill which would cover all signer standards (ICRC-21/25/27/29/49), not just the OISY-specific library.

**Recommendation**: Review and merge the content, but plan to fold it into `wallet-integration` during Phase 3. The OISY-specific patterns (no ICRC-34 delegation, 7-day permission expiry, consent message requirements) are exactly the kind of non-obvious pitfalls that justify skill content. The library-specific API usage may be trimmable.

#### PR #18 — `icrc-ledger` fix (URL corrections, +4/-4 lines)

Corrects download URLs for ICRC ledger WASM and Candid files. This is a straightforward factual fix.

**Recommendation**: Merge as-is. The corrected URLs remain valuable regardless of whether the skill is later renamed to `token-ledger` and trimmed.

#### PR #36 — `internet-identity` revision (+58/-28 lines)

Updates dependencies, versioning, descriptions, and local development setup. Improves clarity on common mistakes.

**Recommendation**: Merge as-is. The improvements align with the direction of the proposed `canister-auth` rename. The content quality improvements will carry forward.

#### PR #49 — `vetkd` version bump (+2/-2 lines)

Patches the vetkd skill version after PR #48 changed title and description without bumping. Trivial fix.

**Recommendation**: Merge as-is. Note: conflicts with PR #50 (both touch `public/llms-full.txt`). Merge #49 first, or rebase after #50.

#### PR #50 — Remove redundant generated files (-7,045 lines)

Removes 4 generation scripts (`generate-skills.js`, `generate-llms.js`, `generate-llms-full.js`, `generate-agent-json.js`) and their committed output files (`public/llms.txt`, `public/llms-full.txt`, `public/.well-known/agent.json`, `public/.well-known/ai-plugin.json`). These are now generated at build time by Astro pages. Simplifies `npm run generate` to only run `generate-readme-table.js`. Updates CI and documentation.

**Recommendation**: Merge. This directly simplifies the build pipeline we reference in §5.4 (conciseness CI check) and §5.11 (infrastructure changes). After this PR, adding `npm run check-conciseness` becomes the natural next CI step. The simplified pipeline also reduces merge conflicts for skill contributors.

---

## 3. External Benchmarks

### 3.1 Anthropic Agent Skills Best Practices

Key principles we should adopt:

| Principle | Current Compliance | Gap |
|-----------|-------------------|-----|
| "Only add context the agent doesn't already have" | **Partial** — pitfalls are good, API code is redundant | Remove boilerplate code agents can generate from Candid interfaces |
| "SKILL.md under 500 lines" | **5 of 13 skills exceed this** | Split large skills into SKILL.md + reference files |
| "Progressive disclosure" | **Not used** — every skill is a single file | Adopt supplementary files for code examples and reference tables |
| "Consistent terminology" | **Good** — enforced by schema and template | Maintain |
| "No time-sensitive information" | **Good** — no dates or version-specific caveats | Maintain |
| "Test with real usage" | **Not done** — no evaluation framework | Create evaluation scenarios per skill |
| "Feedback loops" | **Partial** — verification steps exist but aren't structured as loops | Add validation checklists for complex workflows |
| "Descriptions must include what AND when" | **Partial** — some descriptions lack trigger context | Revise all descriptions |

### 3.2 Community ICP Skills (jorgenbuilder/icp-skills)

**3 skills**: `icp-cli` (3,085 lines across 4 files), `pic-js` (220 lines across 3 files), `forum-research` (652 lines across 4 files).

**Patterns to adopt:**
- **Wrong/right pairs** — Their "Common mistakes to avoid" format (`dfx deploy --network ic` → `icp deploy -e ic`) is more scannable than prose pitfalls. We should adopt this format for migration-related and syntax-related pitfalls.
- **Self-test prompts** — 16 scenario prompts agents can use to validate their own output. Low token cost, high safety value.
- **Decision trees** — Routing agents through choices ("which recipe?", "which environment?") rather than listing all options equally.
- **Doc URL fallbacks** — Pointing agents to canonical documentation URLs as a safety net when the skill doesn't cover an edge case.

**Patterns to avoid:**
- **3,085 lines for one skill is excessive.** Heavy repetition across files (same examples appear in SKILL.md, best-practices.md, examples.md, AND reference.md). The `pic-js` skill at 220 lines across 3 files is much better calibrated.
- **Agent-framework-specific tool call JSON** (explicit `{"tool": "WebFetch", ...}` blocks) only works in Claude Code. Our skills should remain platform-agnostic.
- **No frontmatter schema, no validation, no CI.** Our infrastructure is significantly more mature.

### 3.3 Monolith vs. Modular: The Single-Skill Approach

The `leonardomso/rust-skills` repository uses a single monolith skill with 179 rules organized into 14 thematic categories. SKILL.md serves as a master index linking to individual rule files. This approach has been proposed for IC Skills as well — collapsing all content into one `icp-development` skill with topic-based workflow files.

| Aspect | Monolith Approach | Our Modular Approach |
|--------|-------------------|---------------------|
| Discovery | Agent loads one index, routes to right section | Agent must pick the right skill from 16+ descriptions |
| Context cost | Only index loads initially (~200 lines) | Full SKILL.md loads per skill (300-500 lines) |
| Cross-cutting concerns | One file, no duplication | Same pitfall may appear in multiple skills |
| Granular discovery | Not possible — one skill name for everything | Each skill gets its own discovery entry |
| Maintenance | Must maintain one massive index + N files | Each skill is independently versioned |
| Team contribution | Everyone edits the same skill | Contributors own specific skills |
| Spec compliance | Single entry in agent.json | Full discovery surface with per-skill metadata |

**Our recommendation: Stay modular, but with better cross-referencing.** The monolith approach breaks down when the domain is as broad as IC development. A single "icp-development" skill would have a description so generic that it would match on every query — defeating the purpose of skill discovery. The observation that skills should feel more connected is correct, however. The solution is better cross-references and a shared foundation layer, not a single file.

---

## 4. Gap Analysis

### 4.1 Missing Skills (High Priority)

These represent areas where agents will produce broken or dangerous code without guidance.

#### canister-security

**Priority: Critical.** No existing skill covers IC-specific security patterns. The `certified-variables` skill covers data authenticity but not access control, cycle drains, async TOCTOU, or controller safety. Every production canister needs these patterns.

Key content: `inspect_message` is NOT a security boundary (single-node, skippable, not called for inter-canister calls). Anonymous caller rejection. Cycle drain protection. Async TOCTOU (state mutation between await points). Controller backup. `fetchRootKey` in production. Admin method guards.

#### canister-testing

**Priority: High.** PocketIC is now the default testing framework (dfx >= 0.26), yet no skill exists. The community `pic-js` skill proves demand. Without guidance, agents will generate tests that reference the deprecated replica, use wrong PocketIC API patterns, or skip upgrade-path testing entirely.

Key content: PocketIC setup for Rust/JS/Python. Multi-canister test environments. Time progression for timer testing. Upgrade-path tests (deploy v1 → upgrade to v2 → verify state). Canister state snapshots.

#### icp-cli

**Priority: High.** The `icp` CLI replaces `dfx` with different syntax, a recipe system, and YAML configuration. Agents trained on older documentation will generate `dfx` commands, use `--network ic` instead of `-e ic`, and miss the recipe version pinning requirement. The community has already created a 3,085-line skill for this — we need a properly structured version.

Key content: dfx → icp command mapping. Recipe system (`@dfinity/rust@v3.0.0`, `@dfinity/motoko@v3.0.0`). Environment management (implicit `local`/`ic` environments, custom environments). Network concepts (managed vs connected). Project model (`icp.yaml` replacing `dfx.json`). Identity management. Cycles management (`icp cycles mint`, `icp cycles transfer`).

#### wallet-integration

**Priority: High.** The ICRC signer standards (ICRC-21/25/27/29/34/49) define how dApps communicate with wallets. OISY does NOT support ICRC-34 (delegation), meaning every action requires a user popup. Agents that assume delegation works will produce broken UX. No skill covers consent messages (ICRC-21), the permission lifecycle, or the three integration paths (IdentityKit, signer-js, @dfinity/oisy-wallet-signer). PR #16 (oisy-wallet-signer) partially addresses this but is scoped to one library.

Key content: ICRC signer standard overview. OISY integration paths. Consent message implementation (ICRC-21 on canister side). Permission lifecycle (7-day expiry). No-delegation workaround patterns. IdentityKit vs signer-js vs oisy-wallet-signer decision tree.

### 4.2 Missing Skills (Medium Priority)

#### chain-key-signatures

**Priority: Medium-High.** tECDSA and tSchnorr enable canisters to derive addresses and sign transactions on Bitcoin, Ethereum, and other chains. The existing `ckbtc` and `evm-rpc` skills use chain-key tokens (wrappers) but don't cover the underlying signing primitives. An agent asked to "sign a Bitcoin transaction from a canister" needs to know the management canister API for key derivation and signing.

Key content: tECDSA key derivation (derivation_path structure). tSchnorr for Taproot/Ed25519. Signing flow (create → sign → submit). Key naming conventions. Cross-chain address derivation.

#### canister-timers

**Priority: Medium.** Timers are lost on canister upgrade unless explicitly serialized — a non-obvious data loss scenario. The self-call isolation model means each timer execution costs inter-canister call cycles. The 500-message output queue caps parallelism. None of this is covered by existing skills.

Key content: Timer setup (set_timer, set_timer_interval). Upgrade-safe timer patterns (serialize in pre_upgrade, restore in post_upgrade). Cost implications. Queue limits. Global timer vs per-task timers.

#### orbit-governance

**Priority: Medium.** Orbit provides multi-approval canister governance — the recommended pattern for production teams. Without it, agents generate single-controller setups that are a security anti-pattern. The `dfx-orbit` CLI integration and Station canister architecture need dedicated coverage.

Key content: Orbit Station architecture. Multi-approval policy configuration. dfx-orbit CLI workflow. Adding Orbit as canister controller. Disaster recovery patterns.

### 4.3 Content That Needs Fundamental Rewrite

#### stable-memory → canister-upgrades

The existing `stable-memory` skill covers the **classical** persistence model (explicit `stable var`, `pre_upgrade`/`post_upgrade` hooks, `MemoryManager` in Rust). However:

- **Motoko**: Enhanced Orthogonal Persistence (EOP) is production-default since compiler v0.14.4 and the compiler has since moved to the 1.x series (latest: 1.3.0). The `persistent actor` pattern makes all variables implicitly stable. `pre_upgrade`/`post_upgrade` are deprecated and dangerous (a trap in `pre_upgrade` permanently bricks the canister under classical persistence). An agent generating Motoko code with the old model produces strictly worse code than using EOP defaults.
- **Rust**: The `MemoryManager` + `StableBTreeMap` pattern is still correct for Rust. But the skill should also cover upgrade strategies: versioned stable memory layouts, chunked migrations, and the instruction limit spanning both upgrade hooks.

**Recommendation**: Rename to `canister-upgrades`, rewrite with EOP as the primary Motoko path, keep the Rust stable structures content, and add upgrade-strategy patterns (versioning, migration, rollback).

#### JS code across all skills

Multiple skills include JavaScript/TypeScript code using `@dfinity/agent`, `@dfinity/identity`, and `@dfinity/principal`. These packages are superseded by `@icp-sdk/core` (v5.0.0). All JS code examples need updating. This affects `internet-identity`, `asset-canister`, `icrc-ledger`, and any skill with frontend examples.

### 4.4 Redundant Content

| Repeated Pattern | Appears In | Recommendation |
|-----------------|-----------|----------------|
| "Capture caller before await" | multi-canister, internet-identity, icrc-ledger | State the pitfall in canister-security, link from others |
| "Attach sufficient cycles" | https-outcalls, evm-rpc, ckbtc, wallet | State the cycle cost formula in each relevant skill (context-specific), but explain the WHY once in a shared location |
| Deploy & Test boilerplate (`icp network start`, `icp deploy`) | Every skill | Reference icp-cli skill for CLI mechanics, keep only skill-specific test commands |
| Identity/controller warnings | Multi scattered mentions | Consolidate in canister-security |
| Cycles management commands | wallet, ckbtc, evm-rpc | Consolidate in icp-cli |

### 4.5 Ecosystem Coverage Gaps

Beyond individual skills, there are entire ecosystem areas with no coverage:

| Area | Ecosystem Importance | Skill Coverage |
|------|---------------------|----------------|
| Signer standards (ICRC-21/25/27/29/49) | **Critical** for any user-facing dApp | **None** (PR #16 adds OISY-specific content) |
| PocketIC testing | **Critical** — now the default test environment | **None** |
| @icp-sdk/core (JS SDK v5) | **High** — replaces all @dfinity/* packages | **None** (existing JS code uses deprecated packages) |
| EOP (Motoko persistence) | **High** — production default, changes every Motoko skill | **None** (stable-memory covers old model) |
| Chain-key signatures (tECDSA/tSchnorr) | **High** for cross-chain apps | **None** (ckbtc/evm-rpc use tokens, not raw signing) |
| Orbit multi-sig governance | **Medium-High** for production teams | **None** |
| Canister timers | **Medium** for any app with periodic tasks | **None** |
| NNS governance interaction | **Medium** for governance-integrated apps | **None** |
| ckETH / ckERC20 tokens | **Medium** for DeFi apps | **None** (only ckBTC is covered) |
| Exchange Rate Canister | **Low-Medium** for apps needing price data | **None** |

### 4.6 Frontmatter Alignment (Issue #45)

Issue #45 proposes aligning frontmatter with the [Agent Skills specification](https://agentskills.io/specification). The spec defines exactly **6 top-level fields** — anything else belongs under `metadata` or should be removed.

#### Spec-defined fields (top-level)

| Field | Spec Status | Our Usage | Recommendation |
|-------|------------|-----------|----------------|
| `name` | **Required** | Already compliant | Keep |
| `description` | **Required** | Compliant but too short | **Enrich** with "Use when... Do NOT use for..." trigger phrases |
| `license` | Optional | Not used | **Add** — `Apache-2.0` for all skills |
| `compatibility` | Optional, max 500 chars | Not used | **Add** — replaces `requires` (e.g., `"icp-cli >= 0.2.0"`) |
| `metadata` | Optional, string→string map | Not used | **Adopt** as container for all custom fields |
| `allowed-tools` | Optional (experimental) | Not used | Skip for now |

#### Current non-spec fields — field-by-field verdict

| Field | Current Behavior | Consumed By | Verdict |
|-------|-----------------|-------------|---------|
| `title` | Display name on site | Website cards, skill pages, JSON-LD | **Move to `metadata.title`** |
| `category` | Filter/group on Browse tab | `BrowseTab.tsx`, card icons, JSON-LD | **Move to `metadata.category`** |
| `version` | Semver badge, CI version-bump check | Website badge, CI scripts | **Move to `metadata.version`** |
| `endpoints` | Manually maintained count of documented operations | Website hero stat, card component | **Remove** — manually maintained number that drifts out of sync. No agent value. The site can compute operation counts from content at build time or drop the stat entirely |
| `status` | "beta" badge on Browse tab | `BrowseTab.tsx` conditional badge | **Move to `metadata.status`** — consider deriving from version (< 1.0.0 = beta) |
| `dependencies` | Skill-to-skill graph | Validation (cycle detection), discovery | **Move to `metadata.dependencies`** (as CSV string `"icrc-ledger, ckbtc"`) |
| `tags` | Described as keyword matching | **Nothing** — `BrowseTab.tsx` searches `name` + `description` only | **Remove** — zero functional impact. Keywords belong in `description` |
| `requires` | Tool version constraints | **Nothing** — not in site, not in `llms.txt`, not in `agent.json` | **Remove** — replace with `compatibility` (spec field) |

#### Recommended target frontmatter

```yaml
---
name: canister-security
description: "Secures IC canisters against IC-specific attack patterns. Covers access control, caller validation, cycle drain protection, async state vulnerabilities, and controller safety. Use when implementing any canister that handles user data, tokens, or access control. Do NOT use for canister-level programming patterns."
license: Apache-2.0
compatibility: "icp-cli >= 0.2.0"
metadata:
  title: Canister Security
  category: Security
  version: 1.0.0
  status: stable
  dependencies: ""
---
```

#### Key trade-offs

1. **`metadata` values must be strings per spec.** Arrays become CSV (`"icrc-ledger, ckbtc"`), numbers become `"8"`. The build pipeline needs adjustments to parse these. This is less ergonomic but spec-compliant.

2. **`dependencies` as CSV vs top-level array.** Moving `dependencies` to `metadata.dependencies` is spec-compliant but makes cycle detection validation messier (parsing CSV vs iterating arrays). The practical impact is small — the validation script needs a one-line split.

3. **Removing `tags` has zero risk.** Our audit confirms `tags` is consumed by nothing in the codebase. The `description` field is the agent routing signal. If keyword discovery is ever needed, `metadata.tags` can be re-added.

4. **Removing `endpoints` is low risk.** The field is currently used for a hero stat and card badges on the website, but it's a manually maintained number that easily drifts out of sync with actual content. No agent or discovery mechanism uses it. The site can either compute the count from content at build time (e.g., counting `###` headings under Implementation) or drop the stat entirely in favor of more meaningful metadata.

5. **`compatibility` vs `requires`.** The spec's `compatibility` is a free-text string (max 500 chars), not a structured array. This is less machine-parseable than `requires: [icp-cli >= 0.1.0]` but more flexible and spec-compliant. For our use case, `"icp-cli >= 0.2.0"` in `compatibility` is sufficient.

6. **`license` is low-effort, high-signal.** 14 of 16 Anthropic skills use it. Adding `Apache-2.0` to every skill is a one-line change.

#### Migration impact

The resolution of Issue #45 should happen **before or in parallel with** the skill restructuring to avoid double-migration. The proposed catalog (§5.2) is compatible with both current and proposed frontmatter formats. The draft example skills in `_drafts/` use the **proposed spec-compliant format** as a reference.

---

## 5. Recommendations

### 5.1 Organize by Developer Task, Not IC Feature

**Current**: Skills map to IC subsystems (ckbtc, evm-rpc, icrc-ledger, certified-variables).
**Proposed**: Skills map to developer tasks (canister-security, canister-testing, canister-upgrades, wallet-integration).

The reasoning: agents are invoked when a developer asks "How do I secure my canister?" or "How do I test inter-canister calls?" — not "Tell me about the certified-variables API." Task-oriented skills match how agents discover and load skills.

Feature-specific skills still exist (ckbtc, evm-rpc, etc.) but are trimmed to focus on the non-obvious integration patterns rather than API reference.

### 5.2 Proposed Skill Catalog

#### Tier 1 — Foundation (every IC project needs these)

| # | Skill | Category | Lines (target) | Status |
|---|-------|----------|----------------|--------|
| 1 | **icp-cli** | Infrastructure | ~250 | **New** — project lifecycle, environments, recipes, dfx migration |
| 2 | **canister-security** | Security | ~350 | **New** — access control, cycle drains, async TOCTOU, controller safety |
| 3 | **canister-upgrades** | Architecture | ~400 | **Rewrite** of stable-memory — EOP for Motoko, stable structures for Rust, migration strategies |
| 4 | **canister-testing** | Infrastructure | ~350 | **New** — PocketIC setup, multi-canister tests, upgrade-path tests |

#### Tier 2 — Core Patterns (most projects need 1-3 of these)

| # | Skill | Category | Lines (target) | Status |
|---|-------|----------|----------------|--------|
| 5 | **inter-canister-calls** | Architecture | ~450 | **Refactored** from multi-canister — async model, atomicity, saga patterns |
| 6 | **multi-canister** | Architecture | ~400 | **Trimmed** — when to split, factory pattern, shared types, deployment order (async mechanics move to #5) |
| 7 | **https-outcalls** | Integration | ~450 | **Keep** — already well-calibrated |
| 8 | **canister-auth** | Auth | ~350 | **Renamed** from internet-identity — add signer standard awareness, update JS to @icp-sdk/core |
| 9 | **certified-responses** | Security | ~450 | **Renamed** from certified-variables — no content change needed |
| 10 | **wallet-integration** | Auth | ~400 | **New** — ICRC signer standards, OISY integration, consent messages. Absorbs PR #16 content |

#### Tier 3 — Feature Skills (project-specific)

| # | Skill | Category | Lines (target) | Status |
|---|-------|----------|----------------|--------|
| 11 | **token-ledger** | Tokens | ~400 | **Trimmed** from icrc-ledger — focus on DeFi-safe patterns, remove standard API usage |
| 12 | **bitcoin-integration** | DeFi | ~450 | **Trimmed** from ckbtc — keep subaccount derivation + pitfalls, add ckBTC/direct BTC decision tree |
| 13 | **evm-integration** | Integration | ~400 | **Trimmed** from evm-rpc — keep consensus handling + cycle formula, move call examples to reference file |
| 14 | **chain-key-signatures** | Integration | ~350 | **New** — tECDSA/tSchnorr key derivation, signing flows, cross-chain address generation |
| 15 | **vetkd-encryption** | Security | ~450 | **Trimmed** from vetkd — move code examples to reference file |
| 16 | **sns-governance** | Governance | ~350 | **Trimmed** from sns-launch — focus on tokenomics pitfalls + testflight, remove YAML boilerplate |

#### Skills Removed — see §6.9 for detailed justifications

| Removed | Content Destination |
|---------|-------------------|
| wallet | Freezing threshold → canister-security. Cycles commands → icp-cli |
| ic-dashboard | Drop entirely, or integrate key pitfalls into a relevant skill |
| asset-canister | `.ic-assets.json5` patterns → frontend section in canister-auth or deferred frontend skill |

#### Skills Deferred (potential future additions)

| Skill | Priority | When to Add |
|-------|----------|-------------|
| canister-timers | Medium | When timer-related bugs become a frequent agent failure mode |
| orbit-governance | Medium | When Orbit adoption increases among IC teams |
| nns-governance | Low-Medium | When NNS proposal submission becomes a common agent task |
| cketh-integration | Low-Medium | When ckETH/ckERC20 usage grows beyond the DeFi niche |
| frontend-canister | Low | If asset canister patterns prove to cause frequent agent errors |

### 5.3 Cross-Reference Strategy

Skills reference each other in two ways:

**1. Formal dependencies** (`metadata.dependencies` in frontmatter, CSV string) — machine-readable, used by validation and discovery. Means "this skill builds on concepts from another skill." The agent loads dependency skills when it loads the dependent skill.

```yaml
# inter-canister-calls/SKILL.md
metadata:
  dependencies: canister-security

# bitcoin-integration/SKILL.md
metadata:
  dependencies: token-ledger

# canister-security/SKILL.md — foundation skill, no dependencies
metadata:
  dependencies: ""
```

**2. Inline body links** — agent-readable, used when a concept is explained in detail elsewhere. The rule: **state the pitfall locally, link for the deep pattern.**

```markdown
<!-- In canister-security: state the problem, link for the solution -->
3. **Reading state before an async call and assuming it's unchanged after.**
   This TOCTOU pattern is the #1 source of DeFi exploits on IC. For the full
   async atomicity model and saga compensation patterns,
   see [inter-canister-calls](../inter-canister-calls/SKILL.md).
```

**Dependency graph (proposed):**

```
                    ┌─────────────┐     ┌──────────────────┐
                    │   icp-cli   │     │ canister-security │
                    └──────┬──────┘     └────────┬─────────┘
                           │                     │
            ┌──────────────┼─────────────────────┼──────────────┐
            │              │                     │              │
            ▼              ▼                     ▼              ▼
    ┌───────────────┐ ┌──────────┐ ┌─────────────────────┐ ┌──────────┐
    │canister-testing│ │canister- │ │inter-canister-calls │ │  wallet- │
    └───────────────┘ │ upgrades │ └──────────┬──────────┘ │integration│
                      └──────────┘            │            └──────────┘
                                              │
                      ┌───────────────────────┼────────────────┐
                      │                       │                │
                      ▼                       ▼                ▼
              ┌──────────────┐      ┌──────────────┐   ┌─────────────┐
              │ token-ledger │      │multi-canister│   │canister-auth│
              └──────┬───────┘      └──────────────┘   └─────────────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
    ┌──────────┐ ┌────────┐ ┌──────────────┐
    │  bitcoin-│ │  evm-  │ │   certified- │
    │integration│ │integration│ │  responses │
    └──────────┘ └────────┘ └──────────────┘
```

Foundation skills (`icp-cli`, `canister-security`) are referenced by nearly everything. Feature skills reference core patterns. This creates a layered architecture where agents can load just what they need.

### 5.4 Content Quality Standards

Based on the Anthropic best practices and our analysis, every skill should follow these rules:

#### The Conciseness Test

For every paragraph, code block, or section, ask: **"Would a capable coding assistant already know this?"**

- A coding assistant knows how to call a Candid method given the interface → don't include boilerplate call examples
- A coding assistant does NOT know that `inspect_message` runs on a single node → include this
- A coding assistant knows Rust's `Result` type → don't explain it
- A coding assistant does NOT know the `await (with cycles = N)` Motoko syntax → include this

##### Automating the Conciseness Test

The conciseness test can be partially automated via a `scripts/check-conciseness.js` script that runs in CI alongside `npm run validate`:

**Automated checks (no LLM required):**

| Check | Threshold | What It Catches |
|-------|-----------|-----------------|
| Total SKILL.md line count | ≤ 500 lines | Bloated skills that need progressive disclosure |
| Code block count | ≤ 15 per skill | Skills that are more API reference than guidance |
| Largest code block | ≤ 60 lines | Oversized examples that should be in reference.md |
| Code-to-prose ratio | ≤ 60% code | Skills where code dominates over pitfalls/explanations |
| Duplicate code patterns across skills | Flag if >3 skills share a code block with >80% similarity | Cross-skill redundancy (e.g., same deploy boilerplate) |
| `description` length | ≥ 80 chars, includes "Use when" | Underspecified descriptions that hurt agent discovery |

**Semi-automated checks (LLM-assisted, for PR reviews):**

Run against each code block in a PR:
1. Extract the code block and its surrounding context
2. Prompt: *"Given only the Candid interface for this canister, could a developer produce this code without additional guidance? Answer YES/NO with a one-sentence explanation."*
3. Flag code blocks where the answer is YES — these are candidates for removal

**Proposed CI integration:**

```bash
npm run validate          # Existing: frontmatter, sections, deps
npm run check-conciseness # New: line counts, code ratios, description quality
npm run generate          # Existing: README table freshness
```

The automated checks are cheap (pure text analysis) and can block PRs. The LLM-assisted checks are expensive and should run only on PR review (not on every push).

#### Pitfall Format

Adopt the **wrong/right pair** format from the community `icp-cli` skill for migration-related and syntax-related pitfalls:

```markdown
1. **Using `dfx deploy --network ic`.**
   - Wrong: `dfx deploy --network ic`
   - Right: `icp deploy -e ic`
```

Keep the existing **prose explanation** format for conceptual pitfalls where the "why" matters more than the "what":

```markdown
2. **Relying on `canister_inspect_message` for access control.**
   This hook runs on a SINGLE replica node and can be bypassed by a malicious
   node. It is NEVER called for inter-canister calls. Always duplicate access
   checks inside every update method.
```

#### Progressive Disclosure

For skills approaching or exceeding 500 lines, split into:

```
skill-name/
├── SKILL.md          # Under 500 lines: pitfalls, core patterns, decision trees
└── reference.md      # Code examples, Canister IDs tables, API details
```

SKILL.md links to reference.md with clear context: `For complete Motoko and Rust implementations, see [reference.md](reference.md).`

**Keep references one level deep.** Don't create reference files that link to other reference files.

#### Description Field

Every description must include both WHAT the skill does and WHEN an agent should load it. Write in third person. This aligns with the direction in Issue #45.

```yaml
# Good — includes trigger context
description: "Secures IC canisters against IC-specific attack patterns. Covers access control,
  caller validation, cycle drain protection, and async state vulnerabilities. Use when implementing
  any canister that handles user data, tokens, or access control."

# Bad — missing trigger context
description: "IC canister security patterns."
```

### 5.5 When to Reference External Documentation and Code

External references (links to docs, specs, example repos) are a lightweight way to extend a skill without inflating its token cost. But they have tradeoffs:

#### When to include external references

| Scenario | Example | Rationale |
|----------|---------|-----------|
| **Canonical spec that the skill summarizes** | Link to the ICRC-1 standard from `token-ledger` | Agents can consult the spec for edge cases the skill doesn't cover |
| **Official documentation for deep dives** | Link to IC interface spec from `inter-canister-calls` | The skill covers pitfalls; the spec covers completeness |
| **Example repositories that demonstrate full working projects** | Link to `dfinity/examples` from `canister-testing` | Agents can clone and reference real code |
| **OpenAPI specs for API-heavy skills** | Link to dashboard OpenAPI from relevant integration skills | More accurate than reproducing the API surface in markdown |
| **Changelog or migration guides** | Link to `@icp-sdk/core` migration guide from skills with JS code | Helps agents update deprecated patterns |

#### When NOT to include external references

| Scenario | Why not |
|----------|---------|
| **Linking to docs that explain what the skill already covers** | Redundant — wastes the agent's time navigating away from the skill |
| **Linking to unstable URLs** (forum threads, blog posts) | Links break. If the content is valuable, extract the key insight into the skill |
| **Linking instead of documenting a pitfall** | Pitfalls must be stated IN the skill. "See the security docs" does not prevent an agent from generating insecure code |
| **Linking to source code as a substitute for an explanation** | Agents should not need to read library source code to use the skill correctly |

**Format**: Use markdown links with context about what the link provides:

```markdown
For the complete ICRC-1 standard including optional extensions,
see the [ICRC-1 specification](https://github.com/dfinity/ICRC-1/tree/main/standards/ICRC-1).
```

### 5.6 When to Include Code Examples

Code examples are the most expensive content type (high token count). They must earn their place.

#### Include code when:

| Scenario | Example | Why |
|----------|---------|-----|
| **The pattern is non-obvious or counterintuitive** | Saga compensation after failed inter-canister call | An agent would generate the naive (broken) version without seeing the correct pattern |
| **The correct code differs from what an agent would generate by default** | `persistent actor` (EOP) vs `actor class` (classical) in Motoko | Training data includes both patterns; the skill must establish which is current |
| **The API is new or uncommon enough that agents likely haven't seen many examples** | vetKD IBE encryption/decryption flow | Low training data coverage means agents need examples |
| **Boilerplate setup is required and error-prone** | `thread_local! + RefCell` pattern for Rust canister state | This is a Rust-on-IC idiom that differs from standard Rust |
| **The integration involves multiple coordinated files** | `icp.yaml` + Motoko actor + deploy commands for a specific feature | The coordination between config and code is the value |

#### Do NOT include code when:

| Scenario | Example | Why not |
|----------|---------|---------|
| **It's a standard API call that follows from the Candid interface** | `icrc1_transfer` with standard arguments | Agents can generate this from the .did file or Candid types |
| **It's a slight variation of another example in the same skill** | GET request example + POST request example that differ only in method | One example with a comment about the POST variant suffices |
| **It's a language tutorial** | Explaining how `async`/`await` works in Motoko | Agents already know language mechanics |
| **It duplicates code from a referenced library's README** | Repeating the `@dfinity/oisy-wallet-signer` quickstart | Link to the README instead; include only pitfalls |

#### Rule of thumb

If you remove a code block and the pitfalls section alone would prevent the agent from generating broken code, the code block is optional. If the pitfalls describe WHAT to avoid but the agent still wouldn't know HOW to do it correctly, the code block is necessary.

### 5.7 When to Reference Libraries

The IC ecosystem has many libraries across multiple languages (Motoko packages via mops, Rust crates, JS/TS npm packages, Python packages). Skills should reference libraries but not attempt to document them.

#### The library reference policy

**Always mention**: The library name, package identifier, and minimum version in the **Prerequisites** section.

```markdown
## Prerequisites
- Motoko: `mo:core >= 2.0.0` via mops (`mops add core@2.0.0`)
- Rust: `ic-cdk = "0.19"`, `ic-vetkeys = "0.1.0"`
- JS/TS: `@icp-sdk/core >= 5.0.0` (`npm install @icp-sdk/core`)
```

**Mention in pitfalls** when the library choice itself is a pitfall:

```markdown
3. **Using `@dfinity/agent` instead of `@icp-sdk/core`.** The `@dfinity/*` packages
   are superseded by `@icp-sdk/core` (v5.0.0). Use the migration CLI:
   `npx @icp-sdk/core-migrate`.
```

```markdown
5. **Using `vessel` instead of `mops` for Motoko packages.** Vessel is unmaintained.
   Use mops (mops.one) for all Motoko package management.
```

**Do NOT include**: Full API documentation for a library. That's the library's README/docs job. The skill should focus on IC-specific integration pitfalls when using the library, not on how the library works in general.

**Do NOT duplicate**: Library quickstart examples verbatim. If the library's README shows how to initialize a connection, don't repeat it. Instead, show the IC-specific configuration that the README doesn't cover (e.g., the `fetchRootKey` guard, the correct host URL per environment).

#### Decision tree for library depth

```
Is the library IC-specific (ic-cdk, mo:core, @icp-sdk/core)?
├── Yes → List in Prerequisites + include IC-specific pitfalls
│         Only include code if the usage pattern is non-obvious
└── No (general-purpose: serde, pdfplumber, etc.)
    └── List in Prerequisites only. Agents know how to use general libraries.
```

### 5.8 Criteria for Adding New Skills

To prevent the catalog from growing into a documentation mirror, every proposed skill must pass these acceptance gates:

#### Gate 1: The Failure Test

**"Does a coding assistant produce broken, insecure, or meaningfully suboptimal code for this task WITHOUT the skill?"**

Run a coding assistant on 3 representative tasks related to the proposed skill topic. If it succeeds on all 3 without the skill, the skill is not needed. If it fails on 2+ tasks, the skill is justified.

Examples of passing failures:
- Generates `dfx` commands instead of `icp` commands (→ icp-cli skill needed)
- Relies on `inspect_message` for access control (→ canister-security skill needed)
- Uses `pre_upgrade`/`post_upgrade` hooks in Motoko instead of EOP (→ canister-upgrades skill needed)

Examples of NOT passing:
- Generates slightly verbose but correct ICRC-1 transfer code (→ not a skill, just style preference)
- Doesn't know the exact cycle cost of a specific operation (→ a single line in an existing skill, not a new skill)

#### Gate 2: The Duplication Test

**"Is this content already covered by an existing skill, or by publicly accessible documentation?"**

- If an existing skill covers 80%+ of the proposed content → extend the existing skill instead
- If official documentation covers the topic well and is publicly accessible → write only the pitfalls as an addition to an existing skill, don't create a new one
- If the content is a library API reference → don't create a skill. Link to the library docs from the relevant existing skill's Prerequisites section

#### Gate 3: The Scope Test

**"Can the proposed skill be expressed in under 500 lines with at least 5 non-obvious pitfalls?"**

- If fewer than 5 pitfalls exist → the topic is not complex enough for its own skill. Add the pitfalls to a related skill.
- If the skill would exceed 500 lines even after removing boilerplate → consider splitting the topic or using progressive disclosure with reference files.

#### Gate 4: The Maintenance Test

**"Will this skill need updates more than once a quarter?"**

Skills with rapidly changing APIs or tools have high maintenance costs. If the underlying technology is in active flux:
- Defer the skill until the API stabilizes
- Or write a minimal skill covering only the stable patterns, with a link to the current docs for the changing parts

#### Summary: New Skill Checklist

- [ ] A coding assistant fails 2+ of 3 representative tasks without the skill
- [ ] Content is not 80%+ covered by existing skills or accessible docs
- [ ] At least 5 non-obvious pitfalls identified
- [ ] Can fit in under 500 lines (SKILL.md) with optional reference files
- [ ] Underlying technology is stable enough to maintain
- [ ] Proposed skill name follows naming convention (lowercase, hyphenated, task-oriented)
- [ ] Description includes both WHAT and WHEN trigger phrases

### 5.9 Detailed Removal Justifications

#### `wallet` → Remove and redistribute

**Current content (356 lines, 6 code blocks):**
The skill covers cycles as computation fuel, cycle cost estimates, the Cycles Minting Canister (CMC), freezing threshold configuration, and basic Motoko/Rust patterns for accepting and sending cycles.

**Why remove:**

1. **Fails the Failure Test.** A coding assistant already knows what cycles are (basic blockchain economics) and can generate `icp cycles balance` / `icp cycles mint` commands from CLI help. The mechanical content (check balance, top up, convert ICP) does not prevent agent failures.

2. **The valuable pitfalls belong elsewhere.** The two genuinely non-obvious pitfalls are:
   - "Silent freezing when out of cycles" → moves to `canister-security` (it's a security/operational concern)
   - "Losing controller identity" → moves to `canister-security`

3. **CLI commands duplicate icp-cli.** The cycles management commands (`icp cycles balance`, `icp cycles mint`, `icp cycles transfer`) belong in the `icp-cli` skill where all CLI workflows live.

4. **The Motoko Cycles module migration (ExperimentalCycles → mo:core/ExperimentalCycles → Cycles) is a version-specific detail** that will be outdated once the migration is complete. Rather than maintaining this, a single pitfall in the relevant skill suffices.

**Content destination:**
- Freezing threshold pitfall + controller backup → `canister-security`
- Cycles CLI commands → `icp-cli`
- Cycles attachment in code → documented in each relevant skill (https-outcalls, evm-rpc, etc.) where the context-specific cost formula is what matters

#### `ic-dashboard` → Remove entirely

**Current content (203 lines, 4 code blocks):**
The skill lists API base URLs for dashboard.internetcomputer.org, maps which API serves which data (IC API, ICRC API, SNS API, Ledger API, Metrics API), provides pagination guidance, and documents 8 pitfalls.

**Why remove:**

1. **Fails the Failure Test.** The dashboard APIs are standard REST APIs. A coding assistant can discover endpoints from OpenAPI specs or by inspecting the dashboard's network traffic. There are no IC-specific patterns here — it's just HTTP GET requests to public URLs.

2. **Pure reference content.** The skill is essentially a table of API base URLs and path patterns. This is the kind of content the Anthropic best practices explicitly warn against: "Does the agent really need this explanation?" Agents can fetch `https://ic-api.internetcomputer.org/api/v2/swagger.json` to get the same information.

3. **The pitfalls are mostly about URL formatting**, not about conceptual misunderstandings. "Use the correct base URL" and "format canister IDs correctly" are not the kind of pitfalls that justify a skill — they're the kind of mistakes that self-correct on an HTTP 404.

4. **Low ecosystem importance.** Querying the IC dashboard API is not a common developer task. Most developers interact with canisters directly, not through the dashboard's REST layer.

**If any content is retained:** The single insight worth preserving is that mainnet ICP operations use the Ledger API (not the ICRC API). This could be a one-line note in `token-ledger` if relevant.

#### `asset-canister` → Remove for now (defer to future frontend skill)

**Current content (312 lines, 8 code blocks):**
The skill covers deploying frontend assets, `.ic-assets.json5` configuration, SPA routing with rewrite rules, custom domain DNS setup, programmatic uploads with `@icp-sdk/canisters`, and the authorization model (Prepare/Commit/ManagePermissions roles).

**Why remove for now:**

1. **Partially fails the Failure Test.** A coding assistant can generate basic asset canister deployment from `icp.yaml` configuration alone. The `icp deploy` workflow handles asset upload automatically. Where it DOES fail is on `.ic-assets.json5` configuration (non-obvious file) and the raw access security policy.

2. **The valuable content is narrow.** Only 2-3 pitfalls are genuinely non-obvious: the `.ic-assets.json5` rewrite rules for SPAs, the raw access control policy, and the difference between asset upload authorization vs canister controller authorization. The rest is deployment documentation.

3. **Better as part of a future `frontend-canister` skill.** If a dedicated frontend skill is created later, the asset-canister patterns should be part of it alongside `@icp-sdk/core` frontend setup, II login flow, and certified asset delivery. As a standalone skill, it's too narrow.

4. **No immediate danger.** Unlike missing security or upgrade skills, missing asset canister guidance doesn't lead to broken or insecure code — just suboptimal frontend deployment that can be fixed iteratively.

**Content destination:**
- `.ic-assets.json5` SPA routing + raw access policy → preserved for future `frontend-canister` skill
- Authorization model → if relevant, a note in `canister-auth`
- Deployment steps → redundant with `icp-cli`

### 5.10 Template and Contribution Guidelines Evolution

#### Should we provide a generic template?

**Yes, but it needs revision.** The current template (`skills/_template/SKILL.md.template`) is useful as a structural skeleton. However, it implicitly encourages the "fill in every section with substantial content" approach that leads to bloated skills. The revised template should:

1. **Emphasize the pitfalls section as primary.** The template should make clear that "Mistakes That Break Your Build" is the highest-value section and should be written first.

2. **Make Implementation sections explicitly optional per language.** Not every skill needs Motoko + Rust + JS. The template should state: "Include only the languages relevant to this skill. Do not add empty subsections."

3. **Add guidance comments about the conciseness test.** Each section in the template should include a comment like `<!-- Only include if a coding assistant doesn't already know this. See contribution guidelines. -->`

4. **Include the reference file pattern.** The template should show how to split into SKILL.md + reference.md when content exceeds 500 lines.

5. **Add the Description format guidance.** Show the "Use when..." pattern directly in the template's description field.

#### Proposed template changes

```yaml
---
name: <skill-name>
description: "<What this skill covers. Use when [trigger context]. Do NOT use for [exclusions].>"
license: Apache-2.0
compatibility: "icp-cli >= 0.2.0"
metadata:
  title: "<Display Name>"
  category: <CategoryName>
  version: 1.0.0
  status: stable
  dependencies: ""
---
```

The body template should add comments like:

```markdown
## Implementation

<!-- Include ONLY languages relevant to this skill. Delete unused subsections.
     Include code ONLY when the pattern is non-obvious — i.e., when an agent
     would generate broken code without seeing it. Standard API calls that
     follow from a Candid interface should NOT be included. -->
```

#### CLAUDE.md changes

The CLAUDE.md contribution guidelines should be updated to include:

1. **Skill acceptance criteria** (the 4 gates from §5.8) — as a checklist contributors must address in their PR description
2. **Content quality rules** — the conciseness test, code inclusion policy, and reference policy
3. **Cross-referencing instructions** — how to link to other skills (both `metadata.dependencies` frontmatter and inline links)
4. **The progressive disclosure pattern** — when and how to use reference.md files
5. **The description format** — mandatory "Use when..." trigger phrases
6. **Library reference policy** — what to include in Prerequisites vs what to document in the body
7. **Frontmatter format** — spec-compliant format with `metadata:` for custom fields (see §4.6)

The writing guidelines section should be expanded from the current brief list to include the specific policies defined in this analysis (§5.5 through §5.8).

### 5.11 Infrastructure Changes

#### Multi-file skill support

After PR #50, the build system is simplified: `llms-full.txt` and agent discovery files are generated by Astro pages at build time, and only `generate-readme-table.js` remains as a committed-output script. The system (`scripts/validate-skills.js`, `src/data/skills.ts`) currently expects one file per skill. To support progressive disclosure:

1. **Validation**: Continue validating only SKILL.md frontmatter and required sections. Supplementary files are not validated against the schema.
2. **Generation**: `llms-full.txt` should concatenate SKILL.md only (not reference files). This keeps the discovery payload small. Agents load reference files on-demand.
3. **Website**: Skill pages render SKILL.md content. Supplementary files are linked but not inlined.

#### Frontmatter alignment (Issue #45)

Resolve Issue #45 before or in parallel with the skill restructuring. See §4.6 for the detailed field-by-field analysis and recommended target frontmatter.

**Summary of decisions:**
- **Remove** `tags`, `requires`, and `endpoints` (zero or low-value consumers — see §4.6 for rationale)
- **Add** `license: Apache-2.0` and `compatibility` (spec fields)
- **Move** `title`, `category`, `version`, `status`, `dependencies` under `metadata:` (spec compliance)
- **Enrich** `description` with "Use when..." / "Do NOT use for..." trigger phrases
- **Update** build pipeline to parse string values from `metadata` (CSV for dependencies)

#### Evaluation framework

Create 3 evaluation scenarios per skill (per Anthropic best practices):

```json
{
  "skill": "canister-security",
  "scenario": "Build a canister with admin-only methods",
  "expected_behaviors": [
    "Checks caller != Principal.anonymous()",
    "Does NOT rely solely on inspect_message",
    "Includes authorization guard function",
    "Sets freezing threshold in deployment"
  ]
}
```

Run evaluations with and without the skill to measure delta. This is the source of truth for whether a skill is worth its token cost.

---

## 6. Migration Path

### Phase 1: Foundation (Immediate)

1. **Resolve Issue #45** — align frontmatter with Agent Skills spec. This avoids double-migration during restructuring.
2. **Merge in-flight PRs** — #18 (icrc-ledger fix) and #36 (internet-identity revision) as-is. Hold PR #16 (oisy-wallet-signer) for integration into the broader `wallet-integration` skill.
3. **Create `canister-security`** — highest-value new skill. Every other skill will reference it.
4. **Create `icp-cli`** — enables all other skills to reference it for CLI commands instead of repeating boilerplate.
5. **Rewrite `stable-memory` → `canister-upgrades`** — EOP is production-default, current content is outdated.
6. **Update CLAUDE.md and template** — incorporate the acceptance criteria, content policies, spec-compliant frontmatter format, and cross-referencing instructions from this analysis.
7. **Add conciseness CI check** — `npm run check-conciseness` for line counts, code ratios, and description quality (see §5.4).

### Phase 2: Restructure (Next)

8. **Update all JS code** across existing skills to use `@icp-sdk/core` v5.
9. **Split `multi-canister`** → `inter-canister-calls` (async mechanics) + trimmed `multi-canister` (architecture patterns).
10. **Trim `ckbtc`, `evm-rpc`, `icrc-ledger`** — remove boilerplate API code, move to reference files where needed.
11. **Rename** `certified-variables` → `certified-responses`, `internet-identity` → `canister-auth`.
12. **Remove** `wallet` (merge into icp-cli + canister-security) and `ic-dashboard`.

### Phase 3: Expand (Then)

13. **Create `canister-testing`** — PocketIC patterns (`pocket-ic` 12.x for Rust, `@dfinity/pic` 0.17.x for JS).
14. **Create `wallet-integration`** — ICRC signer standards, OISY (incorporating PR #16 content).
15. **Create `chain-key-signatures`** — tECDSA/tSchnorr primitives.
16. Add evaluation scenarios for all skills.

### Phase 4: Iterate (Ongoing)

17. Run evaluations quarterly. Remove or trim skills that don't improve agent output.
18. Add deferred skills (canister-timers, orbit-governance, nns-governance) based on observed agent failure patterns — each must pass the 4 acceptance gates.
19. Collect community feedback on which skills agents actually load and use.

---

## 7. Appendix

### A. Current → Proposed Skill Mapping

| Current Skill | → | Proposed Skill | Change Type |
|---------------|---|----------------|-------------|
| — | → | **icp-cli** | New |
| — | → | **canister-security** | New |
| — | → | **canister-testing** | New |
| — | → | **wallet-integration** | New (absorbs PR #16) |
| — | → | **chain-key-signatures** | New |
| stable-memory | → | **canister-upgrades** | Rewrite |
| multi-canister | → | **inter-canister-calls** + **multi-canister** | Split |
| internet-identity | → | **canister-auth** | Rename + update |
| certified-variables | → | **certified-responses** | Rename |
| icrc-ledger | → | **token-ledger** | Trim + rename |
| ckbtc | → | **bitcoin-integration** | Trim + rename |
| evm-rpc | → | **evm-integration** | Trim + rename |
| vetkd | → | **vetkd-encryption** | Trim + rename |
| sns-launch | → | **sns-governance** | Trim + rename |
| https-outcalls | → | **https-outcalls** | Keep as-is |
| wallet | → | *(removed — content redistributed)* | Remove — see §5.9 |
| ic-dashboard | → | *(removed)* | Remove — see §5.9 |
| asset-canister | → | *(deferred)* | Remove for now — see §5.9 |

### B. Key Canister IDs for Reference

| Canister | Mainnet ID | Used By Skills |
|----------|-----------|----------------|
| Management canister | `aaaaa-aa` | https-outcalls, inter-canister-calls, chain-key-signatures |
| Internet Identity | `rdmx6-jaaaa-aaaaa-aaadq-cai` | canister-auth |
| ICP Ledger | `ryjl3-tyaaa-aaaaa-aaaba-cai` | token-ledger |
| NNS Governance | `rrkah-fqaaa-aaaaa-aaaaq-cai` | sns-governance |
| Cycles Minting (CMC) | `rkp4c-7iaaa-aaaaa-aaaca-cai` | icp-cli |
| SNS-W | `qaa6y-5yaaa-aaaaa-aaafa-cai` | sns-governance |
| EVM RPC | `7hfb6-caaaa-aaaar-qadga-cai` | evm-integration |
| ckBTC Ledger | `mxzaz-hqaaa-aaaar-qaada-cai` | bitcoin-integration |
| ckBTC Minter | `mqygn-kiaaa-aaaar-qaadq-cai` | bitcoin-integration |
| ckETH Ledger | `ss2fx-dyaaa-aaaar-qacoq-cai` | evm-integration |
| ckETH Minter | `sv3dd-oaaaa-aaaar-qacoa-cai` | evm-integration |
| Exchange Rate (XRC) | `uf6dk-hyaaa-aaaaq-qaaaq-cai` | https-outcalls (example) |

### C. Ecosystem Tool Versions (as of February 2026)

| Tool | Recommended Version | Package / Docs |
|------|-------------------|----------------|
| icp-cli | >= 0.2.0 | `npm install -g @icp-sdk/icp-cli @icp-sdk/ic-wasm` · [cli.icp.build](https://cli.icp.build) |
| Motoko compiler (moc) | >= 1.0.0 (latest: 1.3.0) | installed via mops (`mops toolchain use moc 1.3.0`) |
| ic-wasm | latest | `npm install -g @icp-sdk/ic-wasm` (required by most recipes) |
| ic-cdk (Rust) | 0.19 | `ic-cdk = "0.19"` |
| candid (Rust) | 0.10 | `candid = "0.10"` |
| @icp-sdk/core (JS) | >= 5.0.0 | `npm install @icp-sdk/core` · [js.icp.build/core](https://js.icp.build/core) |
| PocketIC (Rust) | 12.0.0 | `pocket-ic = "12"` |
| @dfinity/pic (JS) | >= 0.17.2 | `npm install @dfinity/pic` · [js.icp.build/pic-js](https://js.icp.build/pic-js/latest) |
| mops (Motoko) | >= 2.0.0 | `npm install -g ic-mops` |
| ic-vetkeys (Rust) | 0.6.0 | `ic-vetkeys = "0.6"` |

### D. New Skill Acceptance Checklist (for PRs)

Every PR proposing a new skill must include answers to these in the PR description:

- [ ] **Failure Test**: 3 representative tasks a coding assistant fails WITHOUT this skill (describe each)
- [ ] **Duplication Test**: Confirmed content is not 80%+ covered by existing skills or public docs
- [ ] **Scope Test**: At least 5 non-obvious pitfalls identified and listed
- [ ] **Size Test**: SKILL.md is under 500 lines (reference files allowed for overflow)
- [ ] **Maintenance Test**: Underlying technology is stable (no expected breaking changes this quarter)
- [ ] **Naming**: Skill name is lowercase, hyphenated, and task-oriented
- [ ] **Description**: Includes "Use when..." trigger phrase and "Do NOT use for..." exclusion (if applicable)
- [ ] **Dependencies**: Correct `metadata.dependencies` declared; inline links to related skills in body text

### E. Example Skills

Two complete example skills demonstrating the proposed structure and cross-referencing pattern are provided in:

- `_drafts/icp-cli/SKILL.md` — Tier 1 foundation skill for CLI tooling
- `_drafts/canister-security/SKILL.md` — Tier 1 foundation skill for security patterns

These examples show:
- **Spec-compliant frontmatter** with `metadata:` for custom fields, `license`, and `compatibility`
- How skills reference each other via inline links (`[icp-cli](../icp-cli/SKILL.md)`)
- How pitfalls are stated locally but deep patterns are linked to other skills
- How to keep SKILL.md under 500 lines while covering Motoko + Rust + frontend
- The proposed wrong/right pair format for migration pitfalls

**Note**: The icp-cli draft uses command syntax based on the icp-cli v0.2.0 documentation. Specific command flags and options should be verified against the latest icp-cli release before publishing.
