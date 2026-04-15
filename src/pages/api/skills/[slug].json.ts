// Per-skill JSON metadata. Stable machine-readable shape for programmatic
// consumers. Includes URLs to every representation of the content so an
// agent can fetch whichever format suits it.

import type { APIRoute } from 'astro';
import {
  getAllSkills,
  getSkillUpdatedAt,
  githubUrl,
  skillUrl,
} from '../../../lib/skills';
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

  const updatedAt = await getSkillUpdatedAt(skill);
  const payload = {
    name: skill.data.name,
    title: skill.data.metadata.title,
    category: skill.data.metadata.category,
    description: skill.data.description,
    license: skill.data.license ?? SITE.license.spdx,
    compatibility: skill.data.compatibility ?? null,
    updated: updatedAt,
    urls: {
      html: absUrl(skillUrl(slug)),
      markdown: absUrl(`/skills/${slug}.md`),
      json: absUrl(`/api/skills/${slug}.json`),
      source: githubUrl(slug),
    },
    publisher: SITE.author,
    canonicalRepo: SITE.repo,
  };

  return new Response(JSON.stringify(payload, null, 2) + '\n', {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Source': githubUrl(slug),
    },
  });
};
