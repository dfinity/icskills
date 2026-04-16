// Raw markdown endpoint: /skills/{slug}/SKILL.md returns the unmodified SKILL.md
// bytes (frontmatter + body). Served with text/markdown so LLM crawlers can
// parse it natively. An attribution header line is prepended as a markdown
// comment so the origin stays visible even if the file is copy-pasted.

import type { APIRoute } from 'astro';
import { getAllSkills, getSkillRawMarkdown, getSkillUpdatedAt, githubUrl } from '../../../lib/skills';
import { SITE, absUrl } from '../../../lib/site';

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
  const updatedAt = await getSkillUpdatedAt(skill);
  const attribution =
    `<!-- source: ${absUrl(`/skills/${slug}/`)} | origin: ${githubUrl(slug)} | ` +
    `publisher: ${SITE.author.name} | license: ${SITE.license.spdx} | updated: ${updatedAt} -->\n`;

  return new Response(attribution + body, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'X-Content-Source': githubUrl(slug),
      'X-License': SITE.license.spdx,
    },
  });
};
