#!/usr/bin/env node
// Post-build: generates dist/skills/{id}/index.html for each skill
// with proper OG/Twitter/JSON-LD meta tags for SEO and social sharing.
// Run after vite build: node scripts/generate-skill-pages.js

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const SKILLS_DIR = join(ROOT, "skills");
const SITE = "https://joshdfn.github.io/icskills";

// Read the built index.html as template
const template = readFileSync(join(DIST, "index.html"), "utf-8");

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const data = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean);
    } else if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    data[key] = val;
  }
  return data;
}

// Escape HTML for safe meta tag values
function esc(str) {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const dirs = readdirSync(SKILLS_DIR).filter((d) => {
  try { return statSync(join(SKILLS_DIR, d, "SKILL.md")).isFile(); } catch { return false; }
}).sort();

let count = 0;

for (const dir of dirs) {
  const content = readFileSync(join(SKILLS_DIR, dir, "SKILL.md"), "utf-8");
  const meta = parseFrontmatter(content);
  if (!meta || !meta.name) continue;

  const id = meta.id || dir;
  const name = meta.name;
  const desc = meta.description || `Agent-readable skill file for ${name} on the Internet Computer.`;
  const category = meta.category || "Skill";
  const version = meta.version || "1.0.0";
  const url = `${SITE}/skills/${id}/`;

  const ogTitle = `${esc(name)} — IC Skills`;
  const ogDesc = esc(desc);
  const twitterDesc = esc(desc.length > 200 ? desc.slice(0, 197) + "..." : desc);

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": `${name} — IC Skills`,
    "description": desc,
    "url": url,
    "version": version,
    "about": { "@type": "Thing", "name": name },
    "isPartOf": { "@id": `${SITE}/#website` },
    "proficiencyLevel": "Expert",
    "keywords": `Internet Computer, ICP, ${name}, ${category}, AI agent, icp-cli`,
  });

  let html = template;

  // Replace title
  html = html.replace(
    /<title>[^<]*<\/title>/,
    `<title>${ogTitle}</title>`
  );

  // Replace meta description
  html = html.replace(
    /<meta name="description" content="[^"]*">/,
    `<meta name="description" content="${ogDesc}">`
  );

  // Replace canonical
  html = html.replace(
    /<link rel="canonical" href="[^"]*">/,
    `<link rel="canonical" href="${url}">`
  );

  // Replace OG tags
  html = html.replace(
    /<meta property="og:url" content="[^"]*">/,
    `<meta property="og:url" content="${url}">`
  );
  html = html.replace(
    /<meta property="og:title" content="[^"]*">/,
    `<meta property="og:title" content="${ogTitle}">`
  );
  html = html.replace(
    /<meta property="og:description" content="[^"]*">/,
    `<meta property="og:description" content="${ogDesc}">`
  );

  // Replace Twitter tags
  html = html.replace(
    /<meta name="twitter:title" content="[^"]*">/,
    `<meta name="twitter:title" content="${ogTitle}">`
  );
  html = html.replace(
    /<meta name="twitter:description" content="[^"]*">/,
    `<meta name="twitter:description" content="${twitterDesc}">`
  );

  // Replace JSON-LD
  html = html.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">${jsonLd}</script>`
  );

  const outDir = join(DIST, "skills", id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  count++;
}

console.log(`Generated ${count} skill pages -> dist/skills/*/index.html`);
