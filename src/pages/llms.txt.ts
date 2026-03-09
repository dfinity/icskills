// Generates /llms.txt at build time — short index of all skills with links
import type { APIRoute } from "astro";
import { loadAllSkills } from "../data/skills";
import { SITE_URL } from "../data/site";

export const GET: APIRoute = () => {
  const skills = loadAllSkills();

  const header = `# IC Skills

> Agent-readable skill files for the Internet Computer. Structured documentation designed for AI coding assistants — not humans.

IC Skills provides copy-paste-ready skill files that teach AI agents how to build on the Internet Computer (ICP) blockchain correctly. Each skill covers one capability (ckBTC, Internet Identity, HTTPS Outcalls, etc.) with exact code, canister IDs, and pitfalls that prevent hallucinations.

## How to use

Fetch any skill file and paste it into your AI agent's context:

\`\`\`
curl -sL ${SITE_URL}/.well-known/skills/<skill-name>/SKILL.md
\`\`\`

## Skills

`;

  const lines = skills.map(
    (s) =>
      `- [${s.title}](${SITE_URL}/.well-known/skills/${s.name}/SKILL.md): ${s.description || `Agent-readable skill file for ${s.title} on the Internet Computer.`}`
  );

  const footer = `
## Skills Discovery

- [Skills index (JSON)](${SITE_URL}/.well-known/skills/index.json): Machine-readable skill index ([Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc))
- [All skills (full text)](${SITE_URL}/llms-full.txt): All skills concatenated for direct context injection

## Source

- [GitHub Repository](https://github.com/dfinity/icskills): All skill files, contribution guide, and website source
- [Contributing Guide](https://github.com/dfinity/icskills/blob/main/CONTRIBUTING.md): How to add or update skills
`;

  return new Response(header + lines.join("\n") + "\n" + footer, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
