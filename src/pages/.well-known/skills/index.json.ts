// Generates /.well-known/skills/index.json at build time
// Implements the Cloudflare Agent Skills Discovery RFC (v0.1)
// https://github.com/cloudflare/agent-skills-discovery-rfc
import type { APIRoute } from "astro";
import { loadAllSkillFiles } from "../../../data/skills";

export const GET: APIRoute = () => {
  const skills = loadAllSkillFiles();

  const index = {
    skills: skills.map((s) => ({
      name: s.name,
      description: s.description,
      files: s.files,
    })),
  };

  return new Response(JSON.stringify(index, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
