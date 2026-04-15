// Generates /.well-known/skills/index.json at build time
// Implements the Cloudflare Agent Skills Discovery RFC (v0.1)
// https://github.com/cloudflare/agent-skills-discovery-rfc
import type { APIRoute } from 'astro';
import { absUrl } from '../../../lib/site';
import { getAllSkills, getSkillFiles } from '../../../lib/skills';

export const GET: APIRoute = async () => {
  const skills = await getAllSkills();

  const index = {
    skills: await Promise.all(
      skills.map(async (s) => ({
        name: s.data.name,
        description: s.data.description,
        url: absUrl(`/.well-known/skills/${s.data.name}/SKILL.md`),
        files: await getSkillFiles(s),
      })),
    ),
  };

  return new Response(JSON.stringify(index, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
