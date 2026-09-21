#!/usr/bin/env node
// Project-specific checks that complement skill-validator's generic validation.
// Covers icskills requirements not part of the Agent Skills spec:
//   - Required metadata fields (title, category) used by the Astro site
//   - Evaluation file existence
//   - Declared moc floor covers every moc diagnostic the skill documents

import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";
import { listSkillDirs, readSkill, SKILLS_DIR } from "./lib/parse-skill.js";

const KNOWN_CATEGORIES = [
  "Auth",
  "CloudEngine",
  "Core",
  "DeFi",
  "Frontend",
  "Governance",
  "Infrastructure",
  "Integration",
  "Motoko",
  "Security",
];

const evalsDir = join(SKILLS_DIR, "..", "evaluations");

// moc diagnostic -> first moc release containing it.
// Regenerate with: node scripts/update-moc-error-codes.js --motoko <path-to-dfinity/motoko>
const mocCodes = JSON.parse(
  readFileSync(join(SKILLS_DIR, "..", "scripts", "data", "moc-error-codes.json"), "utf8")
).codes;

const cmpSemver = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
};

// Every M-code cited anywhere in the skill, including its references/ files.
function citedMocCodes(dir) {
  const files = [join(SKILLS_DIR, dir, "SKILL.md")];
  const refs = join(SKILLS_DIR, dir, "references");
  if (existsSync(refs)) {
    for (const f of readdirSync(refs)) files.push(join(refs, f));
  }
  const codes = new Set();
  for (const f of files) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    for (const m of text.match(/M0\d{3}/g) ?? []) codes.add(m);
  }
  return [...codes].sort();
}
const filterArgs = process.argv.slice(2);
const allDirs = listSkillDirs();
const dirs = filterArgs.length > 0
  ? allDirs.filter((d) => filterArgs.includes(d))
  : allDirs;
const errors = [];
const warnings = [];

for (const dir of dirs) {
  const skill = readSkill(dir);
  if (!skill) continue;
  const label = `${dir}/SKILL.md`;

  // Required metadata fields (used by the Astro site)
  if (!skill.meta.title) {
    errors.push(`${label}: missing required frontmatter field: title`);
  }
  if (!skill.meta.category) {
    errors.push(`${label}: missing required frontmatter field: category`);
  }

  // Category typo detection
  if (skill.meta.category && !KNOWN_CATEGORIES.includes(skill.meta.category)) {
    warnings.push(
      `${label}: unknown category "${skill.meta.category}" — known categories: ${KNOWN_CATEGORIES.join(", ")}`
    );
  }

  // Declared moc floor must cover every diagnostic the skill documents.
  // A skill citing M0268 while declaring moc >= 1.11.2 tells agents to expect
  // an error that toolchain cannot emit.
  const mocFloor = /\bmoc\s*>=\s*(\d+\.\d+\.\d+)/.exec(skill.meta.compatibility ?? "")?.[1];
  const cited = citedMocCodes(dir);
  if (cited.length > 0) {
    const unknown = cited.filter((c) => !mocCodes[c]);
    if (unknown.length) {
      warnings.push(
        `${label}: documents moc diagnostic(s) not in scripts/data/moc-error-codes.json: ${unknown.join(", ")} — regenerate the map (node scripts/update-moc-error-codes.js --motoko <path>), or check the code is real`
      );
    }
    if (mocFloor) {
      const tooNew = cited
        .filter((c) => mocCodes[c] && cmpSemver(mocCodes[c], mocFloor) > 0)
        .map((c) => `${c} (moc ${mocCodes[c]})`);
      if (tooNew.length) {
        errors.push(
          `${label}: declares moc >= ${mocFloor} but documents diagnostics newer than that: ${tooNew.join(", ")} — raise the floor or drop the reference`
        );
      }
    }
  }

  // Evaluation file existence
  if (!existsSync(join(evalsDir, `${dir}.json`))) {
    warnings.push(
      `${label}: missing evaluations/${dir}.json — see CONTRIBUTING.md for evaluation guidance`
    );
  }
}

// --- Output ---

if (warnings.length) {
  console.warn(`\nWARNINGS (${warnings.length}):`);
  warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
}

if (errors.length) {
  console.error(`\nERRORS (${errors.length}):`);
  errors.forEach((e) => console.error(`  ✗ ${e}`));
  process.exit(1);
} else {
  console.log(
    `\n✓ Project checks passed for ${dirs.length} skills (${warnings.length} warnings)`
  );
}
