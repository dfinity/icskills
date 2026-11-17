// /.well-known/agent-skills/<name>/SKILL.md: the raw SKILL.md, byte for byte.
// The index's `digest` for type "skill-md" entries is the SHA-256 of these bytes.
// Served for archive skills too, so agents that can only fetch URLs (not unpack
// an archive) can read any skill directly.
import type { APIRoute } from 'astro';
import { getAllSkills, getSkillRawMarkdown } from '../../../../lib/skills';

export async function getStaticPaths() {
  const skills = await getAllSkills();
  return skills.map((s) => ({ params: { name: s.data.name }, props: { skill: s } }));
}

export const GET: APIRoute = async ({ props }) =>
  new Response(await getSkillRawMarkdown(props.skill), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  });
