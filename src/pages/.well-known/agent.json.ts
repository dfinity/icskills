// Generates /.well-known/agent.json at build time — machine-readable skill manifest
import type { APIRoute } from "astro";
import { loadAllSkills } from "../../data/skills";

const SITE = "https://dfinity.github.io/icskills";
const RAW = "https://raw.githubusercontent.com/dfinity/icskills/main";

export const GET: APIRoute = () => {
  const skills = loadAllSkills();

  const agentJson = {
    name: "IC Skills",
    description:
      "Provides agent-readable skill files for Internet Computer (ICP) development. Retrieve structured markdown with pitfalls, working code, and deploy commands for any IC capability. All skills are licensed under Apache-2.0.",
    url: SITE,
    license: "Apache 2.0",
    capabilities: {
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        lastUpdated: s.lastUpdated,
      })),
    },
    endpoints: {
      list: `${SITE}/llms.txt`,
      full: `${SITE}/llms-full.txt`,
      skill: `${RAW}/skills/{id}/SKILL.md`,
    },
    defaultInputModes: ["text/plain"],
    defaultOutputModes: ["text/plain"],
  };

  return new Response(JSON.stringify(agentJson, null, 2) + "\n", {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
