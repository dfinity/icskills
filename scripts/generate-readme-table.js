#!/usr/bin/env node
// Generates the skills table in README.md from SKILL.md frontmatter
// Run: node scripts/generate-readme-table.js

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { ROOT, readAllSkills } from "./lib/parse-skill.js";

const README = join(ROOT, "README.md");
const START = "<!-- SKILLS-TABLE-START -->";
const END = "<!-- SKILLS-TABLE-END -->";

const skills = readAllSkills()
  .filter((s) => s.meta.id && s.meta.name)
  .sort((a, b) => a.meta.name.localeCompare(b.meta.name));

const header = "| Skill | Category | Description |";
const divider = "|-------|----------|-------------|";
const rows = skills.map(
  (s) =>
    `| [${s.meta.name}](skills/${s.meta.id}/SKILL.md) | ${s.meta.category} | ${s.meta.description.replace(/"/g, "")} |`
);

const table = [START, header, divider, ...rows, END].join("\n");

const readme = readFileSync(README, "utf-8");
const re = new RegExp(`${START}[\\s\\S]*?${END}`);

if (!re.test(readme)) {
  console.error(
    `ERROR: README.md missing ${START} / ${END} markers. Add them around the skills table.`
  );
  process.exit(1);
}

writeFileSync(README, readme.replace(re, table));
console.log(`Updated README.md skills table (${skills.length} skills)`);
