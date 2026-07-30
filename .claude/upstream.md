# Upstream Skill Tracking

All upstream-tracked skills. Update **Tag**, **Commit**, and **Last synced** when syncing a new release.

Upstream file paths are relative to `.agents/skills/<upstream-skill-name>/` in the upstream repo.

---

## motoko

- **Upstream:** https://github.com/caffeinelabs/motoko
- **Tag:** 1.8.2
- **Commit:** f45204bc75c8e0ed5198fd2fe7265679af71814a
- **Last synced:** 2026-05-28
- **Upstream files:**
  - `.agents/skills/writing-motoko/SKILL.md`
  - `.agents/skills/writing-motoko/examples.md → references/examples.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - Pitfall 3: `Text.join` parameter order (iterator first, separator second)
  - Pitfall 4: `List.get` vs `List.at` (safe `?T` vs trapping `T`)
  - Common Compile Error Patterns: M0145 row; M0170 row links to both migrating-motoko skills; M0064 row (`misplaced '!'`)
  - `## Additional References` — links use icskills skill names, not upstream names
- **Pending upstream** ([caffeinelabs/motoko#6156](https://github.com/caffeinelabs/motoko/issues/6156)): pitfalls 3–4 and mops.one/core/docs link. When that issue merges and we sync, drop pitfalls 3–4 and the M0145 error row from icskills-owned (they will come through upstream). The `## Additional References` section stays icskills-owned.
- **Pending upstream** ([caffeinelabs/motoko#6157](https://github.com/caffeinelabs/motoko/issues/6157)): M0064 error table row. When that issue merges and we sync, drop the M0064 row from icskills-owned (it will come through upstream).

---

## migrating-motoko

- **Upstream:** https://github.com/caffeinelabs/motoko
- **Tag:** 1.8.2
- **Commit:** f45204bc75c8e0ed5198fd2fe7265679af71814a
- **Last synced:** 2026-05-28
- **Upstream file:** `.agents/skills/migrating-motoko/SKILL.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - `## Additional References` — section renamed from upstream's "Additional Resources"; links use icskills skill names (e.g., `motoko` not `writing-motoko`); extra link added: `Load \`mops-cli\` for \`mops check\`, \`mops build\`, and toolchain setup`

---

## migrating-motoko-enhanced

- **Upstream:** https://github.com/caffeinelabs/motoko
- **Tag:** 1.8.2
- **Commit:** f45204bc75c8e0ed5198fd2fe7265679af71814a
- **Last synced:** 2026-05-28
- **Upstream file:** `.agents/skills/migrating-motoko-enhanced/SKILL.md`
- **icskills-owned sections (do not overwrite from upstream):**
  - `## Additional References` — section renamed from upstream's "Additional Resources"; links use icskills skill names (e.g., `motoko` not `writing-motoko`); extra link added: `Load \`mops-cli\` for \`mops check\`, \`mops build\`, and toolchain setup`

---

## static-site

- **Upstream:** https://github.com/dfinity/certified-assets
- **Tag:** v0.3.1
- **Commit:** 8ef911f5bc19d7419f577e321b5080e3779fbfcc
- **Last synced:** 2026-07-30
- **Upstream files:** `docs/` (all files) — the certified-assets user documentation is the source of truth for the static-site recipe. Files today: `overview.md`, `routing.md`, `redirects.md`, `headers.md`, `site-files.md`, `access-protection.md`, `how-it-works.md`, `verifying-contents.md`.
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
- **Tag:** cli-v2.19.0
- **Commit:** be449cbeaf8bd9ce6c929b3ceb41591afe8bedca
- **Last synced:** 2026-07-28
- **Upstream file:** `.agents/skills/mops-cli/SKILL.md`
- **icskills-owned sections:** none — body is 1:1 with upstream; only frontmatter differs
