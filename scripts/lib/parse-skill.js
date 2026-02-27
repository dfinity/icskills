// Shared utilities for parsing SKILL.md files.
// All generation scripts import from here — single source of truth.

import { readdirSync, readFileSync, statSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, "..", "..");
export const SKILLS_DIR = join(ROOT, "skills");

/**
 * Parse YAML frontmatter from a SKILL.md file.
 * Returns an object with parsed key-value pairs, or null if no frontmatter found.
 */
export function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const data = {};

  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();

    // Parse arrays: [a, b, c]
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    // Parse numbers
    else if (/^\d+$/.test(val)) {
      val = parseInt(val, 10);
    }
    // Strip quotes
    else if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }

    data[key] = val;
  }

  return data;
}

/**
 * Extract the markdown body (everything after the frontmatter).
 */
export function extractBody(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

/**
 * Get the last updated date for a file using git log.
 * Falls back to file mtime if not in a git repo.
 */
export function getLastUpdated(filePath) {
  try {
    const date = execFileSync(
      "git",
      ["log", "-1", "--format=%cs", "--", filePath],
      { cwd: ROOT, encoding: "utf-8" }
    ).trim();
    if (date) return date;
  } catch {}
  return statSync(filePath).mtime.toISOString().split("T")[0];
}

/**
 * List all skill directories that contain a valid SKILL.md file.
 * Returns sorted array of directory names.
 */
export function listSkillDirs() {
  return readdirSync(SKILLS_DIR)
    .filter((d) => {
      if (d.startsWith("_")) return false; // skip _template etc.
      try {
        return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

/**
 * Read and parse a single SKILL.md file.
 * Returns { dir, filePath, content, meta, body } or null if invalid.
 */
export function readSkill(dir) {
  const filePath = join(SKILLS_DIR, dir, "SKILL.md");
  const content = readFileSync(filePath, "utf-8");
  const meta = parseFrontmatter(content);
  if (!meta) return null;
  const body = extractBody(content);
  return { dir, filePath, content, meta, body };
}

/**
 * Read and parse all valid skills.
 * Returns array of { dir, filePath, content, meta, body }.
 */
export function readAllSkills() {
  return listSkillDirs()
    .map(readSkill)
    .filter((s) => s !== null);
}
