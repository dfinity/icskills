// Serves /.well-known/skills/<name>/SKILL.zip at build time
// Only generated for multi-file skills (SKILL.md + references)
import type { APIRoute } from "astro";
import archiver from "archiver";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, "..", "..", "..", "..", "..", "skills");

function parseName(content: string): string | null {
  const match = content.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    if (key === "name") return line.slice(idx + 1).trim();
  }
  return null;
}

function collectFilePaths(dir: string, baseDir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFilePaths(fullPath, baseDir));
    } else if (entry.isFile()) {
      files.push(fullPath.slice(baseDir.length + 1));
    }
  }
  return files;
}

interface SkillZipData {
  name: string;
  zipBuffer: Buffer;
}

async function buildZip(skillDir: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 9 } });
    const chunks: Buffer[] = [];

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    const files = collectFilePaths(skillDir, skillDir);
    for (const file of files) {
      archive.append(readFileSync(join(skillDir, file)), { name: file });
    }

    archive.finalize();
  });
}

let _cache: SkillZipData[] | null = null;

async function loadMultiFileSkillZips(): Promise<SkillZipData[]> {
  if (_cache) return _cache;

  const dirs = readdirSync(SKILLS_DIR)
    .filter((d) => {
      if (d.startsWith("_")) return false;
      try { return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile(); }
      catch { return false; }
    })
    .sort();

  const skills: SkillZipData[] = [];

  for (const dir of dirs) {
    const skillDir = join(SKILLS_DIR, dir);
    const files = collectFilePaths(skillDir, skillDir);
    if (files.length <= 1) continue; // skip single-file skills

    const content = readFileSync(join(skillDir, "SKILL.md"), "utf-8");
    const name = parseName(content);
    if (!name) continue;

    const zipBuffer = await buildZip(skillDir);
    skills.push({ name, zipBuffer });
  }

  _cache = skills;
  return skills;
}

export async function getStaticPaths() {
  const skills = await loadMultiFileSkillZips();
  return skills.map((s) => ({
    params: { name: s.name },
    props: { zipBuffer: s.zipBuffer },
  }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.zipBuffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="SKILL.zip"`,
    },
  });
};
