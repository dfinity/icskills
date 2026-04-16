// Helpers for querying the skills collection. Keeping this in one place
// means every page, API endpoint, llms.txt, and RSS feed sorts and groups
// skills identically.

import { getCollection, type CollectionEntry } from 'astro:content';
import fs from 'node:fs/promises';
import path from 'node:path';


export type Skill = CollectionEntry<'skills'>;

/** Preferred category order. Unknown categories sort last, alphabetically. */
const CATEGORY_ORDER = [
  'Architecture',
  'Auth',
  'Core',
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

/** Human-facing raw markdown URL for a skill. */
export function skillMarkdownUrl(slug: string): string {
  return `/skills/${slug}/SKILL.md`;
}

/** Canonical GitHub permalink for a skill. */
export function githubUrl(slug: string): string {
  return `https://github.com/dfinity/icskills/blob/main/skills/${slug}/SKILL.md`;
}

/**
 * List all files in a skill's directory, with SKILL.md first.
 * Used by the .well-known/skills/index.json endpoint.
 */
export async function getSkillFiles(skill: Skill): Promise<string[]> {
  const rel = skill.filePath ?? `skills/${skill.id}/SKILL.md`;
  const skillDir = path.dirname(path.resolve(process.cwd(), rel));
  const allFiles = await collectFiles(skillDir, skillDir);
  return ['SKILL.md', ...allFiles.filter((f) => f !== 'SKILL.md').sort()];
}

export interface SkillFileEntry {
  name: string;
  path: string;
  content: string;
}

/**
 * Load all individual reference files across all skills (excluding SKILL.md).
 * Used by the catch-all route at /.well-known/skills/{name}/{path}.
 */
export async function getSkillFileEntries(): Promise<SkillFileEntry[]> {
  const skills = await getAllSkills();
  const entries: SkillFileEntry[] = [];

  for (const skill of skills) {
    const rel = skill.filePath ?? `skills/${skill.id}/SKILL.md`;
    const skillDir = path.dirname(path.resolve(process.cwd(), rel));
    const allFiles = await collectFiles(skillDir, skillDir);

    for (const filePath of allFiles) {
      if (filePath === 'SKILL.md') continue;
      const content = await fs.readFile(path.join(skillDir, filePath), 'utf8');
      entries.push({ name: skill.data.name, path: filePath, content });
    }
  }

  return entries;
}

/** Recursively collect all file paths relative to baseDir, skipping dotfiles. */
async function collectFiles(dir: string, baseDir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath, baseDir)));
    } else if (entry.isFile()) {
      files.push(path.relative(baseDir, fullPath));
    }
  }
  return files;
}
