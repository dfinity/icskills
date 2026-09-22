# `POST /reports` — server contract

This is the maintainer-facing contract for the ingest endpoint the
[ic-skills-feedback](../SKILL.md) skill posts to. It is **not** loaded by agents; it
documents what the server must accept, reject, and guarantee. Keep it in sync with
the skill's payload table and [error-signals.md](error-signals.md).

## Design stance

- Every report is an **untrusted qualitative lead**, never a metric. The endpoint is
  opt-in, self-selected, and poisonable; downstream triage must treat counts as
  hints, not measurements.
- The **server owns all state**: deduplication and triage. The skill is stateless
  and just emits one report per failure.
- **Privacy is enforced server-side too**, not only in the skill — defense in depth.

## Request

```
POST /reports
Content-Type: application/json
```

Body: a single JSON object. See the payload tables in the skill. The server MUST:

1. **Reject** (`400`) if `report_type` is anything other than `failure` or `partial`
   — there is no success ingest.
2. **Reject** unknown top-level keys (strict schema; no additive fields from clients).
3. **Validate enums** (`suspected_cause`, `outcome_after`, `agent`, `consent_basis`).
4. **Re-filter `error_signals`** against the allowlist in
   [error-signals.md](error-signals.md); silently drop non-matching entries. Cap at 5.
5. **Strip prose** — if `free_text_reviewed !== true`, delete `task_summary`,
   `what_went_wrong`, and `workaround` before storage, regardless of whether they were sent.
6. **Length-clamp** `task_summary` (280), `what_went_wrong` (600), and `workaround` (600).
7. **Run a server-side PII scan** over surviving prose (emails, long hex/base32
   principal- and canister-shaped tokens, path-like strings) and quarantine or drop
   on hit. The skill's blocklist is best-effort; this is the backstop.

## Model canonicalization (server-owned)

The skill sends `model` **verbatim** and never normalizes it — so the mapping lives
here, not in the skill, and no skill release is needed when a new model ships.

- Store the received value as `model_raw` on every report, always.
- Maintain an **alias table** (`raw string → canonical id`), editable from the admin
  dashboard. At ingest, compute `model_canonical = aliasTable[model_raw] ?? model_raw`.
- Dashboards group by `model_canonical` and can drill into `model_raw`. An unknown
  new model appears immediately under its exact string; adding one alias row regroups
  it **retroactively** (recompute `model_canonical` on read, or backfill on write).
- Never rewrite or drop `model_raw` — it is the audit trail and lets you fix a bad
  alias later without data loss.

## Anti-abuse

The endpoint is intentionally public, anonymous, and curl-able, so spam cannot be
*prevented* — only its impact neutralized. **v1 ships no active spam protection**; we
watch and add defenses only if real abuse appears.

What keeps spam harmless without any challenge:
- Strict schema + a tight request-body size cap; reject anything malformed or oversized.
- The `error_signals` allowlist + prose length clamps bound what any one report can carry.
- Server-side dedup by `(skill_hash, suspected_cause, error_signals, coarse-day)`,
  comparing `error_signals` as an order-independent (sorted) set.
- The untrusted-lead stance: no decision is ever made on raw counts, and only the
  human-triaged set feeds actions or becomes public — so volume alone changes nothing.
- Store raw ingests separately from the triaged, human-reviewed lead set.

Escalation path if abuse becomes real (do not build preemptively): a proof-of-work
challenge (a served puzzle the client must solve, adding CPU cost per submission),
and/or a thin off-chain relay in front that can rate-limit by IP/edge — something a
canister behind the boundary node cannot reliably do itself.

## Response

- `2xx` with an empty or `{ "ok": true }` body on accept.
- `4xx` on schema violation. The skill does **not** retry on any non-2xx.
- Never echo back stored data; the endpoint is write-only from the client's view.

## The loop this closes

`skill_hash` is the key field. A recurring `(skill_name, skill_hash, suspected_cause,
error_signals)` cluster is a concrete, reproducible failure → write an eval case for it
→ fix the skill → the hash changes → reports on the old hash stop and none appear on
the new hash. That is the signal the whole mechanism exists to produce; satisfaction
scores are not.
