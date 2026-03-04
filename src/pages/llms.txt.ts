// Generates /llms.txt at build time — short index of all skills with links
import type { APIRoute } from "astro";
import { loadAllSkills } from "../data/skills";

const SITE = "https://dfinity.github.io/icskills";
const RAW = "https://raw.githubusercontent.com/dfinity/icskills/main";

export const GET: APIRoute = () => {
  const skills = loadAllSkills();

  const header = `# IC Skills

> Agent-readable skill files for the Internet Computer. Structured documentation designed for AI coding assistants — not humans.

IC Skills provides copy-paste-ready skill files that teach AI agents how to build on the Internet Computer (ICP) blockchain correctly. Each skill covers one capability (ckBTC, Internet Identity, HTTPS Outcalls, etc.) with exact code, canister IDs, and pitfalls that prevent hallucinations.

## How to use

Fetch any skill file and paste it into your AI agent's context:

\`\`\`
curl -sL ${RAW}/skills/<skill-name>/SKILL.md
\`\`\`

## Skills

`;

  const lines = skills.map(
    (s) =>
      `- [${s.title}](${RAW}/skills/${s.name}/SKILL.md): ${s.description || `Agent-readable skill file for ${s.title} on the Internet Computer.`}`
  );

  const footer = `
## Source

- [GitHub Repository](https://github.com/dfinity/icskills): All skill files, contribution guide, and website source
- [Contributing Guide](https://github.com/dfinity/icskills/blob/main/CONTRIBUTING.md): How to add or update skills
`;

  return new Response(header + lines.join("\n") + "\n" + footer, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
