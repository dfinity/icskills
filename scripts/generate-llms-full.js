#!/usr/bin/env node
// Generates llms-full.txt by concatenating all SKILL.md files
// Run: node scripts/generate-llms-full.js

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT = join(ROOT, "public", "llms-full.txt");

const dirs = readdirSync(SKILLS_DIR).filter((d) => {
  try {
    return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
  } catch {
    return false;
  }
}).sort();

const header = `# IC Skills — Full Reference

All IC Skills in a single file for direct context injection.
Source: https://github.com/dfinity/icskills
Skills: ${dirs.length}
`;

const sections = dirs.map((dir) => {
  const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
  return `\n\n---\n\n${content}`;
});

writeFileSync(OUTPUT, header + sections.join(""));
console.log(`Generated llms-full.txt (${dirs.length} skills)`);
