# Error-signal allowlist

`error_signals` in a feedback report may contain **only** tokens that match this
allowlist. The point is that the field cannot carry private data: every entry is
either a fixed compiler/replica **code** or a fixed generic label from the list
below. If an observed error does not match anything here, **omit `error_signals`** —
do not paste the raw message. (Descriptive prose belongs in `what_went_wrong`, and
only with human approval.)

The server re-validates every `error_signals` entry against this same allowlist and
drops non-matching entries — this file is the source of truth for both sides.

## Regex-matched codes (the authoritative, complete part)

These families are complete by construction: any code of the form is accepted, so no
maintenance is needed as new codes appear.

| Pattern | Meaning | Examples |
|---------|---------|----------|
| `^M\d{4}$` | Motoko compiler diagnostic | `M0220`, `M0064`, `M0145` |
| `^IC\d{4}$` | Replica / system error code (incl. runtime traps) | `IC0503`, `IC0501` |

Rust is covered here, not by a separate family: Rust **runtime** failures on the IC
surface as replica trap codes (`IC0503` = `ic0.trap`), which `^IC\d{4}$` catches. Rust
**compile** `E`-codes are intentionally excluded — they are generic Rust, usually about
user code rather than a skill defect.

## Fixed generic labels (best-effort, case-insensitive)

These are a short, deliberately incomplete set of common, objective, non-identifying
phrases. Unlike the code families they are approximations an agent must normalize to,
so treat them as best-effort: if an observed error does not clearly match one, omit it
and let the detail go to human-reviewed prose. Do not grow this list to chase coverage.

Common, non-identifying failure phrases:

- `out of cycles`
- `canister trapped`
- `stable memory out of bounds`
- `delegation expired`
- `signature verification failed`
- `certificate verification failed`
- `candid decode error`
- `candid type mismatch`
- `agent call rejected`
- `subnet not found`
- `method not found`
- `unauthorized`

## Rules

- Max 5 entries per report, each ≤ 60 characters.
- A token not on this list is **not** allowed — omit it rather than approximate.
- Never concatenate a code with surrounding message text (`M0220: ...`) — send the
  bare code only.
- Matching is normalized so skill and server agree: **labels** are compared
  case-insensitively (lowercase both sides); **regex codes** are matched exactly as
  written (case-sensitive — upper-case `M`/`IC`). Send codes in canonical upper case.

## Extending the allowlist

New entries must be provably non-identifying (a fixed compiler/replica code, or a
generic phrase that cannot embed a user's data). Anything that could carry a name,
path, ID, or free text does not belong here — that is what the human-reviewed prose
fields are for. Add the entry here **and** to the server-side validator in the same
change; the two must stay identical.

The full server ingest contract (validation order, storage, model canonicalization)
lives in [endpoint.md](endpoint.md) — maintainer-facing, not loaded by reporting agents.
