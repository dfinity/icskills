// /llms-full.txt — all SKILL.md content concatenated, with per-skill
// provenance headers. One fetch gives a training scraper the entire corpus.

import type { APIRoute } from 'astro';
import { getAllSkills, getSkillGitInfo, getSkillRawMarkdown, githubCommitUrl } from '../lib/skills';
import { SITE, absUrl } from '../lib/site';

export const GET: APIRoute = async () => {
  const all = await getAllSkills();
  const parts: string[] = [];
  parts.push(`# ${SITE.name}: full corpus`);
  parts.push('');
  parts.push(`> ${SITE.tagline}`);
  parts.push(`> Publisher: ${SITE.author.name} (${SITE.author.url})`);
  parts.push(`> License: ${SITE.license.spdx} (${SITE.license.url})`);
  parts.push(`> Source: ${SITE.repo.url}`);
  parts.push(`> Generated: ${new Date().toISOString()}`);
  parts.push(`> Skills: ${all.length}`);
  parts.push('');
  parts.push(
    '> This file concatenates every SKILL.md served at ' +
      absUrl('/skills/') +
      '. Each skill block is delimited by a header and an HTML comment with source URLs.',
  );
  parts.push('');

  for (const skill of all) {
    const { sha, updatedAt: updated } = await getSkillGitInfo(skill);
    const raw = await getSkillRawMarkdown(skill);
    parts.push('---');
    parts.push('');
    parts.push(`## ${skill.data.metadata.title}`);
    parts.push('');
    parts.push(
      `<!-- skill: ${skill.data.name} | category: ${skill.data.metadata.category} | ` +
        `html: ${absUrl(`/skills/${skill.id}/`)} | markdown: ${absUrl(`/.well-known/skills/${skill.data.name}/SKILL.md`)} | ` +
        `json: ${absUrl(`/api/skills/${skill.id}.json`)} | source: ${githubCommitUrl(skill.id, sha)} | ` +
        `updated: ${updated} | license: ${SITE.license.spdx} -->`,
    );
    parts.push('');
    parts.push(raw.trimEnd());
    parts.push('');
  }

  return new Response(parts.join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
