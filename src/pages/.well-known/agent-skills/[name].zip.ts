// /.well-known/agent-skills/<name>.zip: the skill directory as a reproducible
// archive (SKILL.md at the root). The index's `digest` for type "archive"
// entries is the SHA-256 of exactly these bytes. Built for every skill, so the
// skill page's download link works for single-file skills too.
import type { APIRoute } from 'astro';
import { getAllSkills } from '../../../lib/skills';
import { getSkillZip } from '../../../lib/discovery';

export async function getStaticPaths() {
  const skills = await getAllSkills();
  return skills.map((s) => ({ params: { name: s.data.name }, props: { skill: s } }));
}

export const GET: APIRoute = async ({ props }) => {
  const zip = await getSkillZip(props.skill);
  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${props.skill.data.name}.zip"`,
    },
  });
};
