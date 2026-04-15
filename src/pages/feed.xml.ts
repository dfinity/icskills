// /feed.xml — RSS 2.0 feed of skills, sorted by last-updated (newest first).
// Subscribers get notified when upstream SKILL.md files change.

import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getAllSkills, getSkillUpdatedAt, skillUrl } from '../lib/skills';
import { SITE, absUrl } from '../lib/site';

export const GET: APIRoute = async (context) => {
  const all = await getAllSkills();
  const withDates = await Promise.all(
    all.map(async (s) => ({ skill: s, updated: await getSkillUpdatedAt(s) })),
  );
  withDates.sort((a, b) => b.updated.localeCompare(a.updated));

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items: withDates.map(({ skill, updated }) => ({
      title: skill.data.metadata.title,
      link: skillUrl(skill.id),
      description: skill.data.description,
      pubDate: new Date(updated),
      categories: [skill.data.metadata.category],
      author: SITE.author.name,
      customData:
        `<source url="${absUrl(`/skills/${skill.id}.md`)}">raw markdown</source>`,
    })),
    customData:
      `<language>${SITE.locale}</language>` +
      `<copyright>Licensed ${SITE.license.spdx} — ${SITE.author.name}</copyright>`,
  });
};
