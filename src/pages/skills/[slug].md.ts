// Generates /skills/<id>.md at build time — raw SKILL.md content for each skill
import type { APIRoute } from "astro";
import { loadAllSkillsRaw } from "../../data/skills";

export function getStaticPaths() {
  const skills = loadAllSkillsRaw();
  return skills.map((s) => ({
    params: { slug: s.id },
    props: { rawContent: s.rawContent },
  }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.rawContent, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
};
