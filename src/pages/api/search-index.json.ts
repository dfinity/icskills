// Search index for the site's skill search, built from every SKILL.md at build
// time. The homepage fetches it the first time someone searches.
//
// Each entry carries the skill's metadata.summary and metadata.keywords plus
// stemmed terms from its title, description, headings and body. See
// src/lib/search-core.js for how terms are built and ranked.

import type { APIRoute } from 'astro';
import { getAllSkills, skillUrl } from '../../lib/skills';
import { buildSearchDoc } from '../../lib/search-core.js';
import communitySkills from '../../../community/index.json';

export const GET: APIRoute = async () => {
  const skills = await getAllSkills();
  const skillIds = skills.map((s) => s.id);
  const docs = skills.map((s) =>
    buildSearchDoc({
      id: s.id,
      url: skillUrl(s.id),
      title: s.data.metadata.title,
      category: s.data.metadata.category,
      summary: s.data.metadata.summary,
      keywords: s.data.metadata.keywords,
      description: s.data.description,
      body: s.body ?? '',
      skillIds,
    }),
  );
  // Ecosystem skills live in other repos: only their listing text is indexed.
  for (const c of communitySkills) {
    docs.push(
      buildSearchDoc({
        id: c.name,
        url: c.github,
        title: c.title,
        category: 'Ecosystem',
        // No separate summary: the listing description is what results show.
        summary: c.description,
        description: c.description,
        external: true,
      }),
    );
  }

  return new Response(JSON.stringify({ version: 1, count: docs.length, docs }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
};
