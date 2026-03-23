#!/usr/bin/env node
// Project-specific checks that complement skill-validator's generic validation.
// Covers icskills requirements not part of the Agent Skills spec:
//   - Required metadata fields (title, category) used by the Astro site
//   - Evaluation file existence

import { existsSync } from "fs";
import { join } from "path";
import { listSkillDirs, readSkill, SKILLS_DIR } from "./lib/parse-skill.js";

const KNOWN_CATEGORIES = [
  "DeFi",
  "Tokens",
  "Auth",
  "Architecture",
  "Integration",
  "Governance",
  "Frontend",
  "Security",
  "Infrastructure",
  "Wallet",
];

const evalsDir = join(SKILLS_DIR, "..", "evaluations");
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
