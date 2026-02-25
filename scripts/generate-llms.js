#!/usr/bin/env node
// Generates llms.txt — short index of all skills with links to raw SKILL.md files
// Run: node scripts/generate-llms.js

import { readdirSync, readFileSync, writeFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT = join(ROOT, "public", "llms.txt");
const RAW = "https://raw.githubusercontent.com/dfinity/icskills/main";

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

const skills = [];

for (const dir of dirs) {
  const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
  const meta = parseFrontmatter(content);
  if (!meta || !meta.id || !meta.name) continue;
  skills.push({
    id: meta.id,
    name: meta.name,
    description: meta.description || `Agent-readable skill file for ${meta.name} on the Internet Computer.`,
    url: `${RAW}/skills/${dir}/SKILL.md`,
  });
}

const header = `# IC Skills

> Agent-readable skill files for the Internet Computer. Structured, versioned documentation designed for AI coding assistants — not humans.

IC Skills provides copy-paste-ready skill files that teach AI agents how to build on the Internet Computer (ICP) blockchain correctly. Each skill covers one capability (ckBTC, Internet Identity, HTTPS Outcalls, etc.) with exact code, canister IDs, and pitfalls that prevent hallucinations.

## How to use

Fetch any skill file and paste it into your AI agent's context:

\`\`\`
curl -sL https://raw.githubusercontent.com/dfinity/icskills/main/skills/<skill-id>/SKILL.md
\`\`\`

## Skills

`;

const lines = skills.map((s) => `- [${s.name}](${s.url}): ${s.description}`);

const footer = `
## Source

- [GitHub Repository](https://github.com/dfinity/icskills): All skill files, contribution guide, and website source
- [Contributing Guide](https://github.com/dfinity/icskills/blob/main/CONTRIBUTING.md): How to add or update skills
`;

writeFileSync(OUTPUT, header + lines.join("\n") + "\n" + footer);
console.log(`Generated llms.txt (${skills.length} skills)`);
