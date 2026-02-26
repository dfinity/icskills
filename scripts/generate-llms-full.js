#!/usr/bin/env node
// Generates llms-full.txt by concatenating all SKILL.md files
// Run: node scripts/generate-llms-full.js

import { writeFileSync } from "fs";
import { join } from "path";
import { ROOT, readAllSkills } from "./lib/parse-skill.js";

const OUTPUT = join(ROOT, "public", "llms-full.txt");

const skills = readAllSkills();

const header = `# IC Skills — Full Reference

All IC Skills in a single file for direct context injection.
Source: https://github.com/dfinity/icskills
Skills: ${skills.length}
`;

const sections = skills.map((s) => `\n\n---\n\n${s.content}`);

writeFileSync(OUTPUT, header + sections.join(""));
console.log(`Generated llms-full.txt (${skills.length} skills)`);
