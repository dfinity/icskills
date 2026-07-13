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

## mops-cli

- **Upstream:** https://github.com/caffeinelabs/mops
- **Tag:** cli-v2.16.1
- **Commit:** 4bccdc13b512048f41b3296c3590b776c1836fe1
- **Last synced:** 2026-07-10
- **Upstream file:** `.agents/skills/mops-cli/SKILL.md`
- **icskills-owned sections:** none — body is 1:1 with upstream; only frontmatter differs
