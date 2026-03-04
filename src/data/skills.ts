// Build-time skill loader — reads skills/*/SKILL.md files and parses frontmatter.
// This runs at build time only, never shipped to the browser.

import { readdirSync, readFileSync, statSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Skills live in the repo root
const SKILLS_DIR = join(__dirname, "..", "..", "skills");

export interface Skill {
  name: string;
  title: string;
  category: string;
  description: string;
  lastUpdated: string;
  license: string;
  content: string;
}

function parseFrontmatter(content: string): Record<string, any> | null {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const data: Record<string, any> = {};

  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val: any = line.slice(idx + 1).trim();

    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s: string) => s.trim()).filter(Boolean);
    } else if (/^\d+$/.test(val)) {
      val = parseInt(val, 10);
    } else if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    data[key] = val;
  }

  return data;
}

function extractBody(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

function getLastUpdated(filePath: string): string {
  try {
    const root = join(SKILLS_DIR, "..");
    const date = execFileSync(
      "git", ["log", "-1", "--format=%cs", "--", filePath],
      { cwd: root, encoding: "utf-8" }
    ).trim();
    if (date) return date;
  } catch {}
  return statSync(filePath).mtime.toISOString().split("T")[0];
}

export interface SkillRaw {
  name: string;
  rawContent: string;
}

/**
 * Load all skills with their raw SKILL.md content (including frontmatter).
 * Used by llms-full.txt to concatenate all skill files.
 */
export function loadAllSkillsRaw(): SkillRaw[] {
  const dirs = readdirSync(SKILLS_DIR)
    .filter((d) => {
      if (d.startsWith("_")) return false;
      try {
        return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .sort();

  const skills: SkillRaw[] = [];

  for (const dir of dirs) {
    const filePath = join(SKILLS_DIR, dir, "SKILL.md");
    const content = readFileSync(filePath, "utf-8");
    const meta = parseFrontmatter(content);
    if (!meta || !meta.name) continue;

    skills.push({
      name: meta.name,
      rawContent: content,
    });
  }

  return skills;
}

export function loadAllSkills(): Skill[] {
  const dirs = readdirSync(SKILLS_DIR)
    .filter((d) => {
      if (d.startsWith("_")) return false;
      try {
        return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .sort();

  const skills: Skill[] = [];

  for (const dir of dirs) {
    const filePath = join(SKILLS_DIR, dir, "SKILL.md");
    const content = readFileSync(filePath, "utf-8");
    const meta = parseFrontmatter(content);
    if (!meta || !meta.name || !meta.title) continue;

    skills.push({
      name: meta.name,
      title: meta.title,
      category: meta.category || "",
      description: meta.description || "",
      lastUpdated: getLastUpdated(filePath),
      license: meta.license || "",
      content: extractBody(content),
    });
  }

  skills.sort((a, b) => a.title.localeCompare(b.title));
  return skills;
}
