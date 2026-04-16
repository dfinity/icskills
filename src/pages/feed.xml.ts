// /feed.xml — RSS 2.0 feed of skills, sorted by last-updated (newest first).
// Subscribers get notified when upstream SKILL.md files change.

import type { APIRoute } from 'astro';
import rss from '@astrojs/rss';
import { getAllSkills, getSkillGitInfo, skillUrl } from '../lib/skills';
import { SITE, absUrl } from '../lib/site';

export const GET: APIRoute = async (context) => {
  const all = await getAllSkills();
  const withDates = await Promise.all(
    all.map(async (s) => { const { updatedAt } = await getSkillGitInfo(s); return { skill: s, updated: updatedAt }; }),
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
        `<source url="${absUrl(`/.well-known/skills/${skill.data.name}/SKILL.md`)}">raw markdown</source>`,
    })),
    customData:
      `<language>${SITE.locale}</language>` +
      `<copyright>Licensed ${SITE.license.spdx} — ${SITE.author.name}</copyright>`,
  });
};
