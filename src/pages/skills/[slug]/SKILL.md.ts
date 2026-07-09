// Raw markdown endpoint: /skills/{slug}/SKILL.md returns the unmodified SKILL.md
// bytes (frontmatter + body), byte-identical to the repo file. Served with
// text/markdown so LLM crawlers can parse it natively. Provenance is carried in
// the X-Content-Source and X-License response headers, not in the body.

import type { APIRoute } from 'astro';
import { getAllSkills, getSkillGitInfo, getSkillRawMarkdown, githubCommitUrl } from '../../../lib/skills';
import { SITE } from '../../../lib/site';

export async function getStaticPaths() {
  const skills = await getAllSkills();
  return skills.map((skill) => ({ params: { slug: skill.id }, props: { slug: skill.id } }));
}

export const GET: APIRoute = async ({ props }) => {
  const slug = (props as { slug: string }).slug;
  const skills = await getAllSkills();
  const skill = skills.find((s) => s.id === slug);
  if (!skill) return new Response('Not found', { status: 404 });

  const body = await getSkillRawMarkdown(skill);
  const { sha } = await getSkillGitInfo(skill);
  const sourceUrl = githubCommitUrl(slug, sha);

  return new Response(body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Source': sourceUrl,
      'X-License': SITE.license.spdx,
    },
  });
};
