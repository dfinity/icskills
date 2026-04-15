// Serves /.well-known/skills/<name>/SKILL.md at build time
// Implements the Cloudflare Agent Skills Discovery RFC (v0.1)
// https://github.com/cloudflare/agent-skills-discovery-rfc
import type { APIRoute } from 'astro';
import { getAllSkills, getSkillRawMarkdown } from '../../../../lib/skills';

export async function getStaticPaths() {
  const skills = await getAllSkills();
  return skills.map((s) => ({
    params: { name: s.data.name },
    props: { skill: s },
  }));
}

export const GET: APIRoute = async ({ props }) => {
  const rawContent = await getSkillRawMarkdown(props.skill);
  return new Response(rawContent, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
};
