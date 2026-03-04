// Serves /.well-known/skills/<name>/SKILL.md at build time
// Implements the Cloudflare Agent Skills Discovery RFC (v0.1)
// https://github.com/cloudflare/agent-skills-discovery-rfc
import type { APIRoute } from "astro";
import { loadAllSkillsRaw } from "../../../../data/skills";

export function getStaticPaths() {
  const skills = loadAllSkillsRaw();
  return skills.map((s) => ({
    params: { name: s.name },
    props: { rawContent: s.rawContent },
  }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.rawContent, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
};
