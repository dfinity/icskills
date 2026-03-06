### Security skills — status quo, options, and recommendation

Thanks @venkkatesh-sekar for the thorough review and for pointing to [`dfinity-lab/security-skills`](https://github.com/dfinity-lab/security-skills). I cloned it and went through all 11 skills and the test harness in detail. Here's where we stand, three options for moving forward, and a recommendation grounded in how agents actually consume skills — specifically around personas, triggering behavior, and hallucination prevention.

---

#### What exists today

**icskills (main)** — 14 skills focused on "how to build correctly":
`asset-canister`, `certified-variables`, `ckbtc`, `evm-rpc`, `https-outcalls`, `ic-dashboard`, `icp-cli`, `icrc-ledger`, `internet-identity`, `multi-canister`, `sns-launch`, `stable-memory`, `vetkd`, `wallet`

Infrastructure: JSON schema validation, CI that blocks on errors, Astro website, `llms.txt`/`llms-full.txt` generation, GitHub Pages hosting, CODEOWNERS.

**security-skills** — 11 skills focused on "what can go wrong":
- Vulnerability detection (5): `inter-canister-calls`, `identity-management`, `data-storage`, `canister-upgrades`, `denial-of-service`
- Reference knowledge (4): `message-execution`, `cycles-costs`, `rust-cdk`, `safe-retries`
- Meta/process (2): `security-assessor`, `architecture`

Strengths: high content quality, dual-language (Rust + Motoko), severity-rated, excellent `description` fields with "Use when..." / "Do NOT use for..." clauses, and an LLM-as-judge test harness. No CI, no schema validation, no website. All 11 skills would currently fail icskills schema validation (empty `metadata: {}`, extra plugin-specific fields).

**This PR (#58)** — a `canister-security` skill covering IC security fundamentals. The review found accuracy issues (callback trap semantics, missing guard patterns, init method gaps) because it was authored without the security team's domain expertise.

#### Open PRs in flight

| PR | Author | What | Impact |
|---|---|---|---|
| #53 | @raymondk | `icp-dev` meta-skill | Orthogonal to security — addresses #52's "single entry point" question |
| #56 | @venkkatesh-sekar | Authorization pitfall for vetKeys | Merge as-is — security review improving a domain skill |
| #57 | @robin-kunzler | Security review for multi-canister | **Already merged** — added security sections to `multi-canister` |
| #60 | @fspreiss | HTTPS outcalls revision | Merge as-is — includes cycle drain pitfall |
| #61 | @marc0olo | icp-cli trim + candid config | Merge as-is — existing skill refinement |
| #16 | @AntonioVentilii | OISY wallet signer | Independent, needs frontmatter alignment |

---

#### Why personas matter for this decision

The two repos serve **different agent personas** and this is the key factor in deciding how to organize security skills:

| Persona | Trigger | What they need | Current source |
|---|---|---|---|
| **Developer writing code** | "build me a multi-canister app with token transfers" | Implementation patterns with security baked in. Correct CallerGuard code, not just "avoid reentrancy." Must load proactively — developer didn't ask for security. | icskills (partial — has pitfall pointers without the actual patterns) |
| **Developer self-reviewing** | "review my canister before I deploy" | A checklist of IC-specific security concerns with fix patterns. Needs to cover all vulnerability classes — developer doesn't know which apply. | Neither repo covers this well |
| **Security auditor** | "audit this codebase for IC vulnerabilities" | Systematic vulnerability detection with severity ratings, reporting templates, methodology. Goes through vulnerability classes one by one. | security-skills (purpose-built for this) |

The security-skills repo is structured for the **auditor persona** — each skill follows "Security concern → Severity → Expected pattern" and the `security-assessor` meta-skill defines the auditor methodology with impact/likelihood matrices and a 5-question false-positive filter. This structure is excellent for auditing.

icskills is structured for the **developer persona** — "What This Is → Prerequisites → Implementation → Pitfalls." This structure is excellent for building.

**The gap is in between.** When a developer says "build me a multi-canister app" (no mention of security), the agent loads `multi-canister`. That skill currently says:

> *"Avoid reentrancy issues [...] e.g. by employing locking patterns. If more context is needed, you can optionally refer to the [security best practices](https://docs.internetcomputer.org/building-apps/security/inter-canister-calls)"*

The agent cannot follow external URLs during code generation. It will attempt to produce a CallerGuard from training data — which may be outdated (pre-CDK 0.19), incomplete, or hallucinated. Meanwhile, security-skills has the exact correct pattern. **This gap is where hallucinations happen.**

---

#### Option A: Unify both repos into icskills

Port all 11 security-skills into `skills/`, adapt frontmatter, add `@dfinity/security` as CODEOWNER. Single repo, single discovery, single CI.

**What agents get**: One `llms.txt` with ~25 skills. Agent must figure out which of 11 security skills are relevant to the current task.

| Pros | Cons |
|---|---|
| Single discovery point via one `llms.txt` | Agent must correctly select from 11 granular security skills — "build me a multi-canister app" must trigger `inter-canister-calls` even though the user said nothing about security |
| Shared CI and validation | Audit-structured skills ("Security concern → Severity") don't match the developer's workflow |
| One PR can update both domain and security skills | Security team loses autonomy over release cadence |
| | 25 skills in one catalog increases mis-triggering risk (adjacent skills competing for the same prompts) |
| | Onboarding 11 skills at once is a burst of review work |

**Key weakness for hallucination prevention**: The 11 granular security skills are optimized for the auditor persona ("Use when **reviewing** async inter-canister calls"). A developer prompt ("build me a multi-canister app") may not trigger the right security skills because the descriptions use audit language, not development language. The agent doesn't know it needs `inter-canister-calls`, `identity-management`, AND `denial-of-service` for a token transfer canister.

#### Option B: Keep repos separate, inline security patterns into domain skills

Each domain skill includes the most critical security patterns for its domain. Security-skills stays separate for audit workflows.

**What agents get**: Domain skills that are self-contained for writing secure code. Security knowledge is at point-of-use.

| Pros | Cons |
|---|---|
| Security patterns at point of use — no triggering gap | Domain authors need security expertise (creates dependency on security team for review) |
| Self-contained skills — one skill per task | Duplicates content that security-skills already maintains |
| Already happening organically (#56, #57) | Inlined patterns drift from security-skills' maintained versions |
| No second skill source needed for writing code | Domain skills grow significantly (multi-canister is already 1000 lines) |
| | Security-only skills (security-assessor, message-execution, cycles-costs) have no home |

**Key weakness for hallucination prevention**: Relies on domain skill authors (or reviewers) getting the security patterns right and keeping them up to date across 14+ skills. Content drift is likely when maintained by different people than those who wrote the authoritative version.

#### Option C: Keep repos separate, security-team-owned `canister-security` in icskills

A comprehensive security skill in icskills, **owned and maintained by the security team**, covering all IC-specific security patterns with copy-paste correct code. Security-skills repo stays separate for the auditor persona.

**What agents get**: When writing any canister, the `canister-security` skill triggers alongside the relevant domain skill. The agent has both the implementation guidance AND all the correct security patterns in context.

| Pros | Cons |
|---|---|
| **Broad trigger catches the developer persona** — fires for any canister development task, not just explicit security queries | Single skill covering all security topics is larger (est. 500-800 lines) |
| Security team ownership eliminates the accuracy problem from the original review | Requires security team to maintain content in two places (icskills + security-skills) |
| Agent loads ALL relevant security patterns in one shot — no need to guess which of 11 granular skills apply | Some overlap between `canister-security` and domain skill pitfall sections |
| Developer-oriented structure ("Pitfall → Why it matters → Correct pattern") vs audit structure | |
| Domain skills keep brief pitfall pointers; `canister-security` has the full patterns | |
| security-skills stays optimized for the auditor persona with no compromises | |

---

#### Recommendation: Option C — security-team-owned `canister-security` in icskills

The critical insight is that **the two repos serve different personas, and each persona needs a different skill structure.** Trying to force one structure onto both personas (Option A) or splitting security across 14 domain skills (Option B) both create gaps. Option C serves each persona optimally.

**Why this prevents hallucinations most effectively:**

**1. Broad triggering is the #1 defense.** The biggest hallucination risk isn't "agent has the wrong pattern" — it's "agent doesn't know it needs a security pattern at all." When a developer says "build me a token transfer canister," they're not thinking about reentrancy, cycle drain, or `inspect_message` bypass. A single `canister-security` skill with a broad description ("Use when writing or reviewing any IC canister that handles state, user data, tokens, or access control") fires alongside the domain skill. The agent gets security patterns proactively, without the user asking.

With 11 granular skills (Option A), the agent must independently determine that `inter-canister-calls`, `identity-management`, `denial-of-service`, and possibly `data-storage` all apply to a token transfer canister. It will likely load 1-2 at best, missing the others.

**2. Security team ownership eliminates accuracy concerns.** The original review of this PR found accuracy issues because I wrote it without deep security expertise. If the security team owns `canister-security`, the content is authoritative — same team that maintains security-skills maintains the developer-facing version. This was the key weakness of Option C in the original analysis, and it disappears with security team ownership.

**3. One skill = complete security context.** An agent writing a canister loads `canister-security` and gets: access control patterns, CallerGuard with scopeguard/try-finally, inspect_message caveats, upgrade trap prevention, cycle drain protection, anonymous principal rejection — all in one load. No gaps, no reliance on loading the right combination of granular skills.

**4. Each persona gets the right structure.** The `canister-security` skill in icskills uses developer-oriented structure: "Pitfall → Why it matters → Correct pattern." The granular skills in security-skills keep their audit-oriented structure: "Security concern → Severity → Expected pattern → Reporting." Neither compromises for the other.

**5. Domain skills and `canister-security` reinforce each other.** The `multi-canister` skill says "Avoid reentrancy issues [...] by employing locking patterns." The `canister-security` skill (loaded alongside) has the exact CallerGuard code. If only one triggers, the agent still has useful guidance. If both trigger, the guidance is consistent and complementary.

#### How this works in practice

```
Developer: "build me a multi-canister token transfer app"

Agent loads:
  → multi-canister (domain skill)     — project structure, icp.yaml, inter-canister call patterns
  → canister-security (security skill) — CallerGuard, anonymous principal rejection, cycle drain protection
  → icrc-ledger (domain skill)         — token transfer APIs, Candid types

Agent produces: working code with correct security patterns baked in. No hallucination.
```

```
Auditor: "audit this codebase for IC security vulnerabilities"

Agent loads (from security-skills):
  → security-assessor — methodology, severity matrix, reporting template
  → inter-canister-calls — reentrancy, callback traps, untrustworthy callees
  → identity-management — auth tiers, anonymous principal, inspect_message
  → ... (as needed per vulnerability class)

Agent produces: structured vulnerability report with severity ratings. Systematic, not ad-hoc.
```

#### Concrete next steps

1. **Rework this PR (#58)**: restructure `canister-security` for the developer persona, transfer ownership to the security team. The content from security-skills serves as the authoritative source — curate it for the developer audience (pitfall-oriented structure, all patterns with copy-paste correct code, developer-oriented language in the description field)
2. **Security team reviews and co-owns**: `@dfinity/security` as CODEOWNER for `skills/canister-security/`
3. **Domain skills keep brief pitfall pointers**: the existing pattern from #57 (multi-canister security sections) and #56 (vetKeys authorization pitfall) stays — brief pointers that say "avoid X" with `canister-security` providing the full pattern
4. **Security-skills repo stays as-is**: optimized for the auditor persona, distributed via Claude Code plugin + Gemini extension, with its own test harness
5. **Adopt the test harness pattern for icskills independently**: evaluation-driven development benefits all skills, not just security (discussed in #52)

@venkkatesh-sekar @raymondk @alin-at-dfinity — thoughts welcome.
