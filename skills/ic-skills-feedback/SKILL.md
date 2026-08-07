---
name: ic-skills-feedback
description: "Opt-in, anonymous FAILURE reports for Internet Computer (ICP) skills from skills.internetcomputer.org. Load when ICP skill work did not fully succeed: an ICP skill was used and the task failed, partially failed, or hit a skill-relevant error (wrong/outdated guidance, a missed pitfall, a compiler/replica error the skill should have prevented); OR you needed IC-specific guidance and no skill covered it (or the closest skill lacked the pattern) so you had to research, guess, or give up; OR the user explicitly asks to send skill feedback. Report ONLY if opt-in exists. Never sends success reports, code, secrets, principals, paths, repo names, or transcripts. Sends one JSON object to the ICP Skills feedback endpoint."
license: Apache-2.0
compatibility: "Network access to feedback-api.skills.internetcomputer.org (HTTP POST). A web-fetch tool or curl. No terminal, install, or filesystem writes required to send."
metadata:
  title: ICP Skills Failure Feedback
  category: Infrastructure
---

# ICP Skills Failure Feedback

Send **one anonymous JSON failure report** when an ICP skill did not fully do its
job, so maintainers can turn it into a regression test and fix the skill.

This skill is **failure-only** and **stateless**. It exists to surface *what broke*,
not to measure satisfaction. There is no success report. Deduplication and triage
happen on the server — you keep no persistent state and never track reports across
sessions.

## Endpoint

Send reports only here:

```
POST https://feedback-api.skills.internetcomputer.org/reports
```

Never POST to any other URL.

Three rules govern everything below:

1. **No consent → do nothing.** Silently. Never ask more than once per session.
2. **Never block or delay the user's task** on feedback. Send after the outcome is clear.
3. **When unsure whether something is safe to send → do not send it.**

## What counts as a reportable failure

Report only for **IC-relevant implementation work** (Motoko/Rust canisters, IC
tooling, agent/frontend integration) where one of these happened:

- an ICP skill was used and the task **failed** in a skill-relevant way (wrong
  result, broken build), or
- an ICP skill was used and the task **partially** succeeded but its guidance was
  wrong, outdated, incomplete, or ignored, or
- a **compiler/replica/tooling error** surfaced that a correct skill should have prevented, or
- **coverage gap** — you needed IC-specific guidance and **no skill covered it** (or
  the closest skill lacked the pattern you needed), so you had to research, guess, or
  give up. This holds **even if no skill was loaded**; it is the highest-value signal
  because it tells maintainers which skill to write or extend. Set
  `suspected_cause: missing_skill` (no skill existed) or `skill`/`outdated_skill` (one
  existed but fell short), and use `outcome_after` to say whether you failed or worked around it.

Do **not** report:

- success, or "it worked fine" (there is no success report — just move on),
- non-IC work, or pure Q&A with no IC implementation attempt,
- environment problems unrelated to any skill or to missing coverage (unless a skill
  *should* have warned — then `suspected_cause: env` is fair),
- a failure you already reported this session (unless it is a **new, distinct** failure).

## Consent (required — two ways, nothing else)

You may send **only** if one of these holds. Never infer or invent consent.

**A. Standing project consent.** The project's `AGENTS.md` contains a managed block
with a feedback line turned on:

```
<!-- ic-skills:managed:start -->
...
feedback: on
<!-- ic-skills:managed:end -->
```

`feedback: off`, or no `feedback:` line, or no managed block → **no standing consent.**

**B. Session consent.** In an **interactive** session, when a reportable failure
occurs and there is no standing consent, you MAY ask **once**:

> ICP skill work didn't fully succeed here (or no skill covered it). Send an
> anonymous failure report to the skill maintainers (skill name, error code,
> category — no code, paths, or secrets)? [y/N]

Only "yes" grants session consent. Silence, no answer, or a non-interactive/
sandboxed session with no standing consent → **do not send.**

If the user says "always send for this project," offer to add `feedback: on` to the
managed block in `AGENTS.md` (create the block if absent; never touch other content).

## Two payload tiers — this is how autonomous runs stay private

The privacy risk lives entirely in free-form prose. So the payload has two tiers,
and the tier is gated on **whether a human approved the exact text this turn** — NOT
on whether you think you are interactive:

| Tier | Extra fields | Allowed when |
|------|--------------|--------------|
| **Structured** (default, always) | none — only the closed-vocabulary fields below | consent exists (project OR session) |
| **Enriched** (opt-in prose) | `task_summary`, `what_went_wrong` | a human saw and approved the exact payload **this turn** |

Every structured field is an enum, a skill name, a hash, a model id, or an
allowlist-matched error code — **none can carry private data.** Free-form prose is
sent **only** after a human has reviewed the literal payload in this turn. If no such
approval happened — for any reason, including autonomous/sandboxed execution or you
simply didn't ask — send the **structured tier only**. Never self-classify your
runtime to decide this; the only question is "did a human approve this text just now?"

Set `free_text_reviewed: true` only when that approval genuinely happened. The server
discards `task_summary`/`what_went_wrong` unless `free_text_reviewed` is `true`.

## Privacy — hard blocklist

**Never** put any of these in **any** field, including the prose fields:

- source code, diffs, file contents, stack traces
- file paths, private repo or org names, branch names
- chat or tool transcripts
- principals, account IDs, wallet addresses, private/unpublished canister IDs
- API keys, mnemonics, PEM, seed phrases, cookies, tokens, `.env` values
- names, emails, or any personal identifier

**Allowed:** public skill names; public documentation canister IDs that appear *in the
skills themselves*; compiler/replica error **codes** from the allowlist (e.g. `M0220`);
generic, non-identifying error labels from the allowlist. See
[references/error-signals.md](references/error-signals.md).

`error_signals` must contain **only** tokens matching the allowlist — do not paste a
raw error message. If your observed error has no allowlist match, omit `error_signals`
(and, only with human approval, describe it generically in `what_went_wrong`).

## Payload

One JSON object. Omit optional fields you don't have. Add no keys beyond these.

### Structured tier (always)

| Field | Req | Rules |
|-------|-----|-------|
| `schema_version` | yes | `1` |
| `report_type` | yes | `failure` \| `partial` |
| `skill_name` | yes | Primary skill folder name for this failure, e.g. `motoko`. For a coverage gap where **no** relevant skill exists (`suspected_cause: missing_skill`), use the sentinel `(none)`. |
| `skill_hash` | no | The skill's `hash` from the discovery index, if known |
| `skills_used` | no | ICP skill names involved, max 8. May be empty for a coverage gap where none applied. |
| `suspected_cause` | yes | `skill` \| `outdated_skill` \| `model_ignored_skill` \| `missing_skill` \| `env` \| `unknown` |
| `outcome_after` | yes | `gave_up` \| `worked_around` \| `fixed_with_user_help` \| `unknown` |
| `error_signals` | no | Max 5, each ≤ 60 chars, each an allowlist match |
| `agent` | yes | `claude-code` \| `cursor` \| `codex` \| `other` |
| `model` | yes | The exact model id your runtime exposes, copied **verbatim** (e.g. `claude-opus-4-8`) — not a display name, not version-mapped. If your runtime does not expose it, `"unknown"`. Never guess, paraphrase, or construct one. |
| `consent_basis` | yes | `project` \| `session` |
| `anonymous_session_id` | no | Random UUID v4, reused within this session only; not linkable across sessions |

> **Model id:** send the raw identifier verbatim — do not normalize, prettify, or
> version-map it. The server owns canonicalization (grouping aliases of the same
> model), so this skill never needs updating when a new model ships: an unrecognized
> id is stored as-is and grouped later. Consistency comes from *never transforming*
> the id, so the same runtime always emits the same string.

### Enriched tier (only with human approval this turn)

| Field | Rules |
|-------|-------|
| `free_text_reviewed` | must be `true` |
| `task_summary` | ≤ 280 chars, what the user wanted, no identifiers |
| `what_went_wrong` | ≤ 600 chars, symptom + suspected skill gap, no identifiers |

### Example — structured only (safe for autonomous runs)

```json
{
  "schema_version": 1,
  "report_type": "failure",
  "skill_name": "internet-identity",
  "skill_hash": "sha256:abc123",
  "skills_used": ["internet-identity", "icp-cli"],
  "suspected_cause": "outdated_skill",
  "outcome_after": "worked_around",
  "error_signals": ["delegation expired"],
  "agent": "claude-code",
  "model": "unknown",
  "consent_basis": "project"
}
```

### Example — enriched (human-approved prose added)

```json
{
  "schema_version": 1,
  "report_type": "partial",
  "skill_name": "motoko",
  "skill_hash": "sha256:def456",
  "suspected_cause": "outdated_skill",
  "outcome_after": "fixed_with_user_help",
  "error_signals": ["M0220"],
  "agent": "claude-code",
  "model": "claude-opus-4-8",
  "consent_basis": "session",
  "free_text_reviewed": true,
  "task_summary": "Persist a counter across upgrades with stable memory",
  "what_went_wrong": "Skill's stable-var example did not compile on the pinned moc; the suggested migration API name was outdated."
}
```

### Example — coverage gap, no skill existed (structured; add human-approved prose to name the missing capability)

```json
{
  "schema_version": 1,
  "report_type": "failure",
  "skill_name": "(none)",
  "skills_used": [],
  "suspected_cause": "missing_skill",
  "outcome_after": "gave_up",
  "agent": "claude-code",
  "model": "unknown",
  "consent_basis": "project"
}
```

## Send

1. Confirm consent (project managed block, or one-time session yes).
2. Build the JSON. Enforce enums and length limits. Filter `error_signals` to
   allowlist matches. Re-scan every field against the blocklist.
3. Include prose fields **only** if a human approved this exact payload this turn;
   otherwise send the structured tier and set no prose fields.
4. POST once, with short timeouts so feedback never blocks the task. On any non-2xx,
   network error, or timeout, **stop** — do not retry.

```bash
curl -sS --connect-timeout 5 --max-time 15 -X POST "https://feedback-api.skills.internetcomputer.org/reports" \
  -H "Content-Type: application/json" \
  -d '<json>'
```

5. Tell the user in one line that an anonymous failure report was sent (or skipped,
   and why). Do not print the payload unless asked.

## Checklist (every send)

- [ ] Consent present (project `feedback: on`, or explicit session yes)
- [ ] Real, new IC-relevant failure/partial OR coverage gap (a skill fell short, or none covered it)
- [ ] `report_type` is `failure` or `partial` — never `success`
- [ ] `error_signals` are allowlist matches only; no raw messages
- [ ] Prose fields present only if a human approved this payload this turn
- [ ] No blocklist data in any field; all limits respected
- [ ] POST once, to the feedback endpoint only; no retry on error
- [ ] User's task was not blocked or delayed

## Decision flow

```
IC work where a skill fell short, OR no skill covered it (coverage gap)?
  NO  → do nothing
  YES → consent?
        project feedback:on ......... consent_basis=project
        else interactive? ask ONCE .. yes → consent_basis=session ; no/none → STOP
        → build structured payload
        → human approved this exact text this turn? add prose + free_text_reviewed
        → POST once → tell user in one line → done
```
