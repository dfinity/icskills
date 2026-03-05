#!/usr/bin/env node
// Validates SKILL.md files for structural correctness.
// Checks frontmatter fields, required sections, and code block annotations.
// Run: node scripts/validate-skills.js

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { readAllSkills, SKILLS_DIR } from "./lib/parse-skill.js";

const REQUIRED_FRONTMATTER = [
  "name",
  "title",
  "category",
  "description",
];

// Known categories — warn on unknown to catch typos, but don't block.
// To add a new category: add it here, in skill.schema.json, and in src/components/Icons.tsx.
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

// Recommended sections (## heading text) — warn if missing, don't block
const RECOMMENDED_SECTIONS = [
  "What This Is",
  "Prerequisites",
  "Implementation",
];

const errors = [];
const warnings = [];

function error(skill, msg) {
  errors.push(`${skill}: ${msg}`);
}

function warn(skill, msg) {
  warnings.push(`${skill}: ${msg}`);
}

const skills = readAllSkills();

// Load JSON schema for allowed categories (read from schema if it exists)
let schema = null;
try {
  schema = JSON.parse(
    readFileSync(join(SKILLS_DIR, "skill.schema.json"), "utf-8")
  );
} catch {
  // Schema is optional for validation
}

for (const skill of skills) {
  const { dir, meta, body } = skill;
  const label = `${dir}/SKILL.md`;

  // --- Frontmatter validation ---

  for (const field of REQUIRED_FRONTMATTER) {
    if (meta[field] === undefined || meta[field] === "") {
      error(label, `missing required frontmatter field: ${field}`);
    }
  }

  // name must match directory name
  if (meta.name && meta.name !== dir) {
    error(label, `frontmatter name "${meta.name}" does not match directory "${dir}"`);
  }

  // name format
  if (meta.name && !/^[a-z][a-z0-9-]*$/.test(meta.name)) {
    error(label, `name "${meta.name}" must be lowercase alphanumeric with hyphens`);
  }

  // category — warn on unknown to catch typos
  if (meta.category && !KNOWN_CATEGORIES.includes(meta.category)) {
    warn(
      label,
      `unknown category "${meta.category}" — known categories: ${KNOWN_CATEGORIES.join(", ")}`
    );
  }

  // --- Section validation ---

  // Extract all ## headings from body
  const headings = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^## (.+)$/);
    if (match) headings.push(match[1].trim());
  }

  for (const section of RECOMMENDED_SECTIONS) {
    if (!headings.includes(section)) {
      warn(label, `missing recommended section: "## ${section}"`);
    }
  }

  // --- Code block validation ---

  // Check that opening code blocks have language annotations.
  // Track open/close state: odd occurrences of ``` are openers, even are closers.
  const codeBlockMarkers = body.match(/^```.*$/gm) || [];
  let insideBlock = false;
  for (const marker of codeBlockMarkers) {
    if (!insideBlock) {
      // This is an opening marker — must have a language annotation
      if (marker === "```") {
        warn(label, `code block without language annotation found`);
        break; // One warning per file is enough
      }
    }
    insideBlock = !insideBlock;
  }

  // --- Recommended fields ---

  if (!meta.license) {
    warn(label, `missing "license" field in frontmatter`);
  }

  if (!meta.compatibility) {
    warn(label, `missing "compatibility" field in frontmatter`);
  }

  // --- Evals validation ---
  const evalsDir = join(SKILLS_DIR, "..", "evaluations");
  if (!existsSync(join(evalsDir, `${dir}.json`))) {
    warn(label, `missing evaluations/${dir}.json — see CONTRIBUTING.md for evaluation guidance`);
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
    `\n✓ All ${skills.length} skills passed validation (${warnings.length} warnings)`
  );
}
