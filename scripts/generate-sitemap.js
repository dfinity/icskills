#!/usr/bin/env node
// Generates sitemap.xml from skill directories
// Run: node scripts/generate-sitemap.js

import { readdirSync, writeFileSync, statSync } from "fs";
import { execFileSync } from "child_process";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SKILLS_DIR = join(ROOT, "skills");
const OUTPUT = join(ROOT, "public", "sitemap.xml");
const SITE = "https://joshdfn.github.io/icskills";
const RAW = "https://raw.githubusercontent.com/JoshDFN/icskills/main";

function getLastMod(filePath) {
  try {
    const date = execFileSync("git", ["log", "-1", "--format=%cs", "--", filePath], { cwd: ROOT, encoding: "utf-8" }).trim();
    if (date) return date;
  } catch {}
  return statSync(filePath).mtime.toISOString().split("T")[0];
}

const dirs = readdirSync(SKILLS_DIR).filter((d) => {
  try {
    return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile();
  } catch {
    return false;
  }
}).sort();

const today = new Date().toISOString().split("T")[0];

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

for (const dir of dirs) {
  const filePath = join(SKILLS_DIR, dir, "SKILL.md");
  const lastmod = getLastMod(filePath);
  // Skill page URL (rendered HTML)
  xml += `  <url>
    <loc>${SITE}/skills/${dir}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
`;
  // Raw SKILL.md URL (for agents)
  xml += `  <url>
    <loc>${RAW}/skills/${dir}/SKILL.md</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
`;
}

xml += `  <url>
    <loc>${SITE}/llms.txt</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE}/llms-full.txt</loc>
    <lastmod>${today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;

writeFileSync(OUTPUT, xml);
console.log(`Generated sitemap.xml (${dirs.length} skills)`);
