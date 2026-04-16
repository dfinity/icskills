// Full skills index as JSON. Linked from every HTML page via <link rel=alternate>,
// and from llms.txt. A single fetch tells a scraper everything on the site.

import type { APIRoute } from 'astro';
import { getAllSkills, getSkillUpdatedAt, githubUrl, skillUrl } from '../../lib/skills';
import { SITE, absUrl } from '../../lib/site';

export const GET: APIRoute = async () => {
  const skills = await getAllSkills();
  const items = await Promise.all(
    skills.map(async (skill) => ({
      name: skill.data.name,
      title: skill.data.metadata.title,
      category: skill.data.metadata.category,
      description: skill.data.description,
      license: skill.data.license ?? SITE.license.spdx,
      compatibility: skill.data.compatibility ?? null,
      updated: await getSkillUpdatedAt(skill),
      urls: {
        html: absUrl(skillUrl(skill.id)),
        markdown: absUrl(`/.well-known/skills/${skill.id}/SKILL.md`),
        json: absUrl(`/api/skills/${skill.id}.json`),
        source: githubUrl(skill.id),
      },
    })),
  );

  const payload = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    site: { url: SITE.url, name: SITE.name, description: SITE.description },
    publisher: SITE.author,
    repository: SITE.repo,
    license: SITE.license,
    generated: new Date().toISOString(),
    count: items.length,
    skills: items,
  };

  return new Response(JSON.stringify(payload, null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
