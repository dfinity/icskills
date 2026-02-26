#!/usr/bin/env node
// Generates llms.txt — short index of all skills with links to raw SKILL.md files
// Run: node scripts/generate-llms.js

import { writeFileSync } from "fs";
import { join } from "path";
import { ROOT, readAllSkills } from "./lib/parse-skill.js";

const OUTPUT = join(ROOT, "public", "llms.txt");
const RAW = "https://raw.githubusercontent.com/dfinity/icskills/main";

const skills = readAllSkills()
  .filter((s) => s.meta.id && s.meta.name)
  .map((s) => ({
    id: s.meta.id,
    name: s.meta.name,
    description:
      s.meta.description ||
      `Agent-readable skill file for ${s.meta.name} on the Internet Computer.`,
    url: `${RAW}/skills/${s.dir}/SKILL.md`,
  }));

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

const lines = skills.map(
  (s) => `- [${s.name}](${s.url}): ${s.description}`
);

const footer = `
## Source

- [GitHub Repository](https://github.com/dfinity/icskills): All skill files, contribution guide, and website source
- [Contributing Guide](https://github.com/dfinity/icskills/blob/main/CONTRIBUTING.md): How to add or update skills
`;

writeFileSync(OUTPUT, header + lines.join("\n") + "\n" + footer);
console.log(`Generated llms.txt (${skills.length} skills)`);
