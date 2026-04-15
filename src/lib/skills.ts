// Helpers for querying the skills collection. Keeping this in one place
// means every page, API endpoint, llms.txt, and RSS feed sorts and groups
// skills identically.

import { getCollection, type CollectionEntry } from 'astro:content';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type Skill = CollectionEntry<'skills'>;

/** Preferred category order — matches the upstream site. Unknown categories sort last, alphabetically. */
const CATEGORY_ORDER = [
  'Architecture',
  'Auth',
  'DeFi',
  'Frontend',
  'Governance',
  'Infrastructure',
  'Integration',
  'Security',
  'Tokens',
  'Wallet',
];

export async function getAllSkills(): Promise<Skill[]> {
  const skills = await getCollection('skills');
  return skills.sort((a, b) => a.data.metadata.title.localeCompare(b.data.metadata.title));
}

export async function getSkillsByCategory(): Promise<Array<{ category: string; skills: Skill[] }>> {
  const all = await getAllSkills();
  const byCat = new Map<string, Skill[]>();
  for (const s of all) {
    const c = s.data.metadata.category;
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c)!.push(s);
  }
  const categories = Array.from(byCat.keys()).sort((a, b) => {
    const ai = CATEGORY_ORDER.indexOf(a);
    const bi = CATEGORY_ORDER.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });
  return categories.map((category) => ({ category, skills: byCat.get(category)! }));
}

/**
 * Returns the last-modified ISO date string for a skill, derived from its
 * SKILL.md file mtime. Used as the "updated" timestamp in UI, JSON-LD, and
 * the RSS feed so freshness signals match the underlying file.
 */
export async function getSkillUpdatedAt(skill: Skill): Promise<string> {
  // Astro's content loader exposes the source filePath in `filePath`.
  const rel = skill.filePath ?? `upstream/skills/${skill.id}/SKILL.md`;
  const abs = path.resolve(process.cwd(), rel);
  try {
    const stat = await fs.stat(abs);
    return stat.mtime.toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Returns the raw SKILL.md source (frontmatter + body). Used by the raw
 * markdown endpoint so scrapers get byte-identical content to the upstream.
 */
export async function getSkillRawMarkdown(skill: Skill): Promise<string> {
  const rel = skill.filePath ?? `skills/${skill.id}/SKILL.md`;
  const abs = path.resolve(process.cwd(), rel);
  return fs.readFile(abs, 'utf8');
}

/** Canonical human URL for a skill on this site. */
export function skillUrl(slug: string): string {
  return `/skills/${slug}/`;
}

/** Canonical GitHub permalink for a skill. */
export function githubUrl(slug: string): string {
  return `https://github.com/dfinity/icskills/blob/main/skills/${slug}/SKILL.md`;
}

// Suppress unused import warning when this file is the only consumer.
void fileURLToPath;
