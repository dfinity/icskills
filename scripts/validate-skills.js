#!/usr/bin/env node
// Validates SKILL.md files for structural correctness.
// Checks frontmatter fields, required sections, code block annotations,
// dependency graph integrity, and canister ID format.
// Run: node scripts/validate-skills.js

import { readFileSync } from "fs";
import { join } from "path";
import { readAllSkills, SKILLS_DIR } from "./lib/parse-skill.js";

const REQUIRED_FRONTMATTER = [
  "name",
  "title",
  "category",
  "description",
  "version",
  "endpoints",
  "status",
];

const VALID_CATEGORIES = [
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

const VALID_STATUSES = ["stable", "beta"];

// Required sections (## heading text) — every skill must have these
const REQUIRED_SECTIONS = [
  "What This Is",
  "Prerequisites",
  "Mistakes That Break Your Build",
  "Implementation",
  "Deploy & Test",
  "Verify It Works",
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
const allIds = new Set(skills.map((s) => s.meta.name));

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

  // version format
  if (meta.version && !/^\d+\.\d+\.\d+$/.test(meta.version)) {
    error(label, `version "${meta.version}" must be semver (e.g., 1.0.0)`);
  }

  // category
  if (meta.category && !VALID_CATEGORIES.includes(meta.category)) {
    error(
      label,
      `category "${meta.category}" not in allowed list: ${VALID_CATEGORIES.join(", ")}`
    );
  }

  // status
  if (meta.status && !VALID_STATUSES.includes(meta.status)) {
    error(label, `status "${meta.status}" must be "stable" or "beta"`);
  }

  // endpoints must be positive integer
  if (meta.endpoints !== undefined && (typeof meta.endpoints !== "number" || meta.endpoints < 1)) {
    error(label, `endpoints must be a positive integer, got: ${meta.endpoints}`);
  }

  // dependencies must reference existing skill names
  const deps = Array.isArray(meta.dependencies) ? meta.dependencies : [];
  for (const dep of deps) {
    if (!allIds.has(dep)) {
      error(label, `dependency "${dep}" does not match any skill name`);
    }
    if (dep === meta.name) {
      error(label, `skill cannot depend on itself`);
    }
  }

  // --- Section validation ---

  // Extract all ## headings from body
  const headings = [];
  for (const line of body.split("\n")) {
    const match = line.match(/^## (.+)$/);
    if (match) headings.push(match[1].trim());
  }

  for (const section of REQUIRED_SECTIONS) {
    if (!headings.includes(section)) {
      error(label, `missing required section: "## ${section}"`);
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

  // --- Duplicate version line check ---

  // The `> version:` line should no longer exist in skill bodies
  if (/^> version:/m.test(body)) {
    error(
      label,
      `body still contains "> version:" line — version should only be in frontmatter`
    );
  }

  // --- Recommended fields ---

  if (!Array.isArray(meta.requires) || meta.requires.length === 0) {
    warn(label, `missing "requires" field in frontmatter`);
  }

  if (!Array.isArray(meta.tags) || meta.tags.length === 0) {
    warn(label, `missing "tags" field in frontmatter`);
  }
}

// --- Dependency cycle detection (simple DFS) ---

function hasCycle(name, visited, stack) {
  visited.add(name);
  stack.add(name);
  const skill = skills.find((s) => s.meta.name === name);
  if (!skill) return false;
  const deps = Array.isArray(skill.meta.dependencies)
    ? skill.meta.dependencies
    : [];
  for (const dep of deps) {
    if (!visited.has(dep)) {
      if (hasCycle(dep, visited, stack)) return true;
    } else if (stack.has(dep)) {
      error(
        `${name}/SKILL.md`,
        `circular dependency detected: ${name} -> ... -> ${dep}`
      );
      return true;
    }
  }
  stack.delete(name);
  return false;
}

const visited = new Set();
for (const skill of skills) {
  if (!visited.has(skill.meta.name)) {
    hasCycle(skill.meta.name, visited, new Set());
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
