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
  fileCount: number;
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
 * Used by the discovery RFC endpoint to serve individual SKILL.md files.
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

/** Recursively collect all file paths relative to baseDir, skipping dotfiles/dirs */
function collectFiles(dir: string, baseDir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(fullPath.slice(baseDir.length + 1)); // relative path
    }
  }
  return files;
}

export interface SkillWithFiles {
  name: string;
  description: string;
  files: string[];
}

/**
 * Load all skills with their file listings for the discovery index.
 * Returns name, description, and all files in the skill directory.
 * SKILL.md is always listed first.
 */
export function loadAllSkillFiles(): SkillWithFiles[] {
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

  const skills: SkillWithFiles[] = [];

  for (const dir of dirs) {
    const skillDir = join(SKILLS_DIR, dir);
    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    const meta = parseFrontmatter(content);
    if (!meta || !meta.name) continue;

    const allFiles = collectFiles(skillDir, skillDir);
    const files = [
      "SKILL.md",
      ...allFiles.filter((f) => f !== "SKILL.md").sort(),
    ];

    skills.push({
      name: meta.name,
      description: meta.description || "",
      files,
    });
  }

  return skills;
}

export interface SkillFileEntry {
  name: string;
  path: string;
  content: string;
}

/**
 * Load all individual files across all skills.
 * Used by the catch-all route to serve files at /.well-known/skills/{name}/{path}.
 */
export function loadAllSkillFileEntries(): SkillFileEntry[] {
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

  const entries: SkillFileEntry[] = [];

  for (const dir of dirs) {
    const skillDir = join(SKILLS_DIR, dir);
    const skillMdContent = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    const meta = parseFrontmatter(skillMdContent);
    if (!meta || !meta.name) continue;

    const allFiles = collectFiles(skillDir, skillDir);
    for (const filePath of allFiles) {
      // Skip SKILL.md — it's served by its own dedicated route
      if (filePath === "SKILL.md") continue;
      entries.push({
        name: meta.name,
        path: filePath,
        content: readFileSync(join(skillDir, filePath), "utf-8"),
      });
    }
  }

  return entries;
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
    const skillDir = join(SKILLS_DIR, dir);
    const filePath = join(skillDir, "SKILL.md");
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
      fileCount: collectFiles(skillDir, skillDir).length,
    });
  }

  skills.sort((a, b) => a.title.localeCompare(b.title));
  return skills;
}
