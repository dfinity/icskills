# Upstream Skill Tracking

All upstream-tracked skills. Update **Commit** (and **Tag**/**Version** where present) and **Last synced** when syncing.

Upstream file paths and the tracking model (release-tag vs commit) are listed per skill — they differ by upstream repo layout.

---

## writing-motoko

- **Upstream:** https://github.com/caffeinelabs/skills
- **Tracking model:** commit-based (this repo has no releases/tags). Watch for changes to the skill folder between the pinned commit and `main`; the per-skill `version:` frontmatter field is a secondary signal.
- **Commit:** 9274f9bb5d34db77c29304ea32ec5ad7bdc3d6fc
- **Upstream version:** 0.1.8 (skill frontmatter `version:`)
- **Last synced:** 2026-08-24
- **Upstream files:**
  - `skills/writing-motoko/SKILL.md`
  - `skills/writing-motoko/api-reference.md → references/api-reference.md`
  - `skills/writing-motoko/examples.md → references/examples.md`
  - `skills/writing-motoko/references/control-flow.md → references/control-flow.md`
  - `skills/writing-motoko/references/equality.md → references/equality.md`
  - `skills/writing-motoko/references/project-setup.md → references/project-setup.md`
  - `skills/writing-motoko/references/reserved-keywords.md → references/reserved-keywords.md`
  - `skills/writing-motoko/references/type-conversions.md → references/type-conversions.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - **Frontmatter (entire block):** upstream ships `version:`, an object `compatibility:` (`toolchain.moc`/`mops.core`/`mops` CLI major), and `caffeineai-subscription:`, and no `metadata:` block. We replace it with our schema: owned `description` (tuned for repo-wide trigger evals), `license: Apache-2.0`, string `compatibility` (`moc >= 1.11.2, core >= 2.5.0, mops >= 3.0.0`), and `metadata.title`/`category`.
  - **mops docs link → `mops-cli` skill:** the body's `https://docs.mops.one/` reference is rewritten to "Load the `mops-cli` skill …". Do not restore the external link on sync.
  - **`## Additional Resources` → `## Additional References`** (section renamed), plus an extra `- **mops tooling**: Load \`mops-cli\` …` bullet not in upstream.
  - **Reference-file paths:** upstream keeps `api-reference.md`/`examples.md` at the skill root; icskills places all non-SKILL files under `references/`, so intra-skill links are rewritten to `references/…`.

---

## migrating-motoko-actors

- **Upstream:** https://github.com/caffeinelabs/skills
- **Tracking model:** commit-based (no releases/tags). Same as `writing-motoko`.
- **Commit:** 9274f9bb5d34db77c29304ea32ec5ad7bdc3d6fc
- **Upstream version:** 0.2.2 (skill frontmatter `version:`, unchanged — no content changes in this sync)
- **Last synced:** 2026-08-24
- **Upstream files:**
  - `skills/migrating-motoko-actors/SKILL.md`
  - `skills/migrating-motoko-actors/examples.md → references/examples.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - **Frontmatter (entire block):** same transform as `writing-motoko` (owned `description`, `license`, string `compatibility`, `metadata`). The description drops the reference to the retired inline skill and points failures at `troubleshooting-motoko-migrations`.
  - **`## Additional Resources` → `## Additional References`** rename, plus an extra `- **mops tooling**: Load \`mops-cli\` …` bullet not in upstream.
  - **Reference-file path:** `examples.md → references/examples.md`; intra-skill link rewritten.

---

## troubleshooting-motoko-migrations

- **Upstream:** https://github.com/caffeinelabs/skills
- **Tracking model:** commit-based (no releases/tags). Same as `writing-motoko`.
- **Commit:** 9274f9bb5d34db77c29304ea32ec5ad7bdc3d6fc
- **Upstream version:** 0.1.3 (skill frontmatter `version:`, unchanged — no content changes in this sync)
- **Last synced:** 2026-08-24
- **Upstream file:** `skills/troubleshooting-motoko-migrations/SKILL.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - **Frontmatter (entire block):** same transform as the other two. Body is otherwise 1:1 with upstream (the `## Related skills` heading is kept as-is).

---

## static-site

- **Upstream:** https://github.com/dfinity/certified-assets
- **Tag:** v0.3.3
- **Commit:** ac2a8e71802b40abb56078ca759b4c0f94f5fe35
- **Last synced:** 2026-08-03
- **Upstream files:** `docs/` — the certified-assets user documentation is the source of truth for the static-site recipe. The sync check diffs **all files** in `docs/` recursively (`scripts/sync-upstream-check.sh` uses the Git Trees API with `?recursive=1`), so nested `docs/<subdir>/` files are covered. Files today (all top-level): `overview.md`, `routing.md`, `redirects.md`, `headers.md`, `site-files.md`, `access-protection.md`, `how-it-works.md`, `verifying-contents.md`.
- **Relationship:** the icskills `static-site` SKILL.md is **derived, not 1:1** — it is an agent-focused condensation of the upstream docs plus icskills-only material (legacy asset-canister reference, migration guide, cross-skill links). Treat the upstream diff as an **advisory review trigger**: when `docs/` changes, review whether the SKILL.md or its references need updating; do not mechanically overwrite.
- **icskills-owned sections (entirely icskills-authored, never overwrite from upstream):**
  - The whole `SKILL.md` body (derived/condensed; agent pitfalls, icp.yaml framing, verify commands)
  - `references/legacy-asset-canister.md` — legacy SDK asset canister (`@dfinity/asset-canister`); has no upstream equivalent in certified-assets docs
  - `references/migrating-from-asset-canister.md` — migration guide; icskills-only
  - `## Additional References` — cross-links use icskills skill names
- **Recipe version note:** the recipe is `@dfinity/static-site@<v>` from [dfinity/icp-cli-recipes](https://github.com/dfinity/icp-cli-recipes/releases?q=static-site); its version tracks the certified-assets release. Update pinned versions in code examples when bumping the tag.

---

## mops-cli

- **Upstream:** https://github.com/caffeinelabs/mops
- **Tag:** cli-v3.1.0
- **Commit:** a4857f9609c3ec5dc45a2a807ebb88e8a856eec6
- **Last synced:** 2026-08-24
- **Upstream file:** `.agents/skills/mops-cli/SKILL.md`
- **icskills-owned sections:** none — body is 1:1 with upstream; only frontmatter differs
