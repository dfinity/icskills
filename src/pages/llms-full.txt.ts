// Generates /llms-full.txt at build time — all SKILL.md files concatenated
import type { APIRoute } from "astro";
import { loadAllSkillsRaw } from "../data/skills";
import { SITE_URL } from "../data/site";

export const GET: APIRoute = () => {
  const skills = loadAllSkillsRaw();

  const header = `# IC Skills — Full Reference

All IC Skills in a single file for direct context injection.
Source: https://github.com/dfinity/icskills
Website: ${SITE_URL}
Skills: ${skills.length}
`;

  const sections = skills.map((s) => `\n\n---\n\n${s.rawContent}`);

  return new Response(header + sections.join(""), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
