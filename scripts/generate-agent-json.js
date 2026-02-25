#!/usr/bin/env node
// Generates public/.well-known/agent.json from skill directories
// Run: node scripts/generate-agent-json.js

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT_DIR = join(ROOT, "public", ".well-known");
const OUTPUT = join(OUTPUT_DIR, "agent.json");

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return data;
}

const dirs = readdirSync(SKILLS_DIR).filter((d) => {
  try {
    return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
  } catch {
    return false;
  }
}).sort();

const skillIds = [];

for (const dir of dirs) {
  const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
  const meta = parseFrontmatter(content);
  if (!meta || !meta.id) continue;
  skillIds.push(meta.id);
}

const agentJson = {
  name: "IC Skills",
  description: "Provides agent-readable skill files for Internet Computer (ICP) development. Retrieve structured markdown with pitfalls, working code, and deploy commands for any IC capability.",
  url: "https://joshdfn.github.io/icskills",
  version: "1.0.0",
  capabilities: {
    skills: skillIds,
  },
  defaultInputModes: ["text/plain"],
  defaultOutputModes: ["text/plain"],
};

mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(OUTPUT, JSON.stringify(agentJson, null, 2) + "\n");
console.log(`Generated agent.json (${skillIds.length} skills)`);
