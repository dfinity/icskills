#!/usr/bin/env node
// Post-build: generates dist/sitemap.xml from skill directories.
// Uses git commit dates for lastmod (deterministic, no "today" drift).
// Run after vite build: node scripts/generate-sitemap.js

import { writeFileSync } from "fs";
import { join } from "path";
import { ROOT, listSkillDirs, getLastUpdated, SKILLS_DIR } from "./lib/parse-skill.js";

const DIST = join(ROOT, "dist");
const SITE = "https://skills.internetcomputer.org";

const dirs = listSkillDirs();

// Derive homepage/aggregate lastmod from the most recently changed skill
const skillDates = dirs.map((dir) =>
  getLastUpdated(join(SKILLS_DIR, dir, "SKILL.md"))
);
const latestDate = skillDates.sort().pop() || "2025-01-01";

let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE}/</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
`;

for (const dir of dirs) {
  const filePath = join(SKILLS_DIR, dir, "SKILL.md");
  const lastmod = getLastUpdated(filePath);
  xml += `  <url>
    <loc>${SITE}/skills/${dir}/</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
  </url>
`;
}

xml += `  <url>
    <loc>${SITE}/llms.txt</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${SITE}/llms-full.txt</loc>
    <lastmod>${latestDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
`;

writeFileSync(join(DIST, "sitemap.xml"), xml);
console.log(`Generated sitemap.xml (${dirs.length} skills) -> dist/`);
