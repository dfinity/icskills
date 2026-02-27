// Generates /.well-known/ai-plugin.json at build time — OpenAI plugin manifest format
import type { APIRoute } from "astro";
import { loadAllSkills } from "../../data/skills";

const SITE = "https://dfinity.github.io/icskills";

export const GET: APIRoute = () => {
  const skills = loadAllSkills();
  const skillIds = skills.map((s) => s.id);

  const aiPlugin = {
    schema_version: "v1",
    name_for_human: "IC Skills",
    name_for_model: "ic_skills",
    description_for_human: `Agent-readable skill files for Internet Computer (ICP) development. Covers ${skillIds.length} capabilities including ckBTC, ICRC ledger, Internet Identity, stable memory, HTTPS outcalls, EVM RPC, SNS, and more.`,
    description_for_model: `Retrieve structured skill files for Internet Computer (ICP) development. Each skill is a markdown document with prerequisites, pitfalls, tested code blocks, and deploy commands. Use the raw GitHub URLs to inject skills directly into context. Available skills: ${skillIds.join(", ")}.`,
    auth: {
      type: "none",
    },
    logo_url: `${SITE}/favicon.svg`,
    contact_email: "skills@internetcomputer.org",
    legal_info_url: `${SITE}/`,
  };

  return new Response(JSON.stringify(aiPlugin, null, 2) + "\n", {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
