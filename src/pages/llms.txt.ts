// Generates /llms.txt at build time — lightweight pointer to discovery endpoints
import type { APIRoute } from "astro";
import { loadAllSkills } from "../data/skills";
import { SITE_URL } from "../data/site";

export const GET: APIRoute = () => {
  const skills = loadAllSkills();

  const lines = skills.map(
    (s) =>
      `- [${s.name}](${SITE_URL}/.well-known/skills/${s.name}/SKILL.md): ${s.description}`
  );

  const body = `# Internet Computer (ICP) Skills

> Agent-readable skill files for building on the Internet Computer. ${skills.length} skills available.

## Install

\`\`\`
npx skills add dfinity/icskills
npx skills add dfinity/icskills --skill ckbtc
\`\`\`

## Discovery

- [Skills index (JSON)](${SITE_URL}/.well-known/skills/index.json): Machine-readable index following the [Agent Skills Discovery RFC](https://github.com/cloudflare/agent-skills-discovery-rfc)
- Individual skill: \`${SITE_URL}/.well-known/skills/{name}/SKILL.md\`

## Skills

${lines.join("\n")}

## Source

- [GitHub Repository](https://github.com/dfinity/icskills)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
