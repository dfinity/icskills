// /.well-known/skills/<name>/SKILL.zip: v0.1.0-era archive URL, kept for old
// links. Same bytes as /.well-known/agent-skills/<name>.zip.
import type { APIRoute } from 'astro';
import { getAllSkills } from '../../../../lib/skills';
import { getSkillZip } from '../../../../lib/discovery';

export async function getStaticPaths() {
  const skills = await getAllSkills();
  return skills.map((s) => ({ params: { name: s.data.name }, props: { skill: s } }));
}

export const GET: APIRoute = async ({ props }) => {
  const zip = await getSkillZip(props.skill);
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="SKILL.zip"',
    },
  });
};
