// Serves /.well-known/skills/<name>/SKILL.md: the v0.1.0-era per-file URL, kept
// because installed autosync scripts and AGENTS.md blocks in users' repos fetch
// from it. The current location is /.well-known/agent-skills/<name>/SKILL.md.
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
