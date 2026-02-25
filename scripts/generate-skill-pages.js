#!/usr/bin/env node
// Post-build: generates dist/skills/{id}/index.html for each skill
// with proper OG/Twitter/JSON-LD meta tags for SEO and social sharing.
// Also copies built index.html to dist/404.html for SPA fallback.
// Run after vite build: node scripts/generate-skill-pages.js

import { readdirSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist");
const SKILLS_DIR = join(ROOT, "skills");
const SITE = "https://dfinity.github.io/icskills";

// Read the built index.html as template
const template = readFileSync(join(DIST, "index.html"), "utf-8");

// Copy built index.html to 404.html for GitHub Pages SPA fallback
writeFileSync(join(DIST, "404.html"), template);

function parseFrontmatter(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
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

  // Escape </script> in JSON-LD to prevent breaking out of script tag
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "TechArticle",
    "headline": `${name} — IC Skills`,
    "description": desc,
    "url": url,
    "version": version,
    "author": { "@type": "Organization", "name": "DFINITY Foundation", "url": "https://dfinity.org" },
    "about": { "@type": "Thing", "name": name },
    "isPartOf": { "@id": `${SITE}/#website` },
    "proficiencyLevel": "Expert",
    "keywords": `Internet Computer, ICP, ${name}, ${category}, AI agent, icp-cli`,
  }).replace(/<\//g, "<\\/");

  let html = template;

  // Use arrow functions in replacements to avoid $& interpretation
  html = html.replace(/<title>[^<]*<\/title>/, () => `<title>${ogTitle}</title>`);
  html = html.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${ogDesc}">`);
  html = html.replace(/<link rel="canonical" href="[^"]*">/, () => `<link rel="canonical" href="${url}">`);
  html = html.replace(/<meta property="og:url" content="[^"]*">/, () => `<meta property="og:url" content="${url}">`);
  html = html.replace(/<meta property="og:title" content="[^"]*">/, () => `<meta property="og:title" content="${ogTitle}">`);
  html = html.replace(/<meta property="og:description" content="[^"]*">/, () => `<meta property="og:description" content="${ogDesc}">`);
  html = html.replace(/<meta name="twitter:title" content="[^"]*">/, () => `<meta name="twitter:title" content="${ogTitle}">`);
  html = html.replace(/<meta name="twitter:description" content="[^"]*">/, () => `<meta name="twitter:description" content="${twitterDesc}">`);

  // Ensure og:image and twitter:image are present
  const ogImage = `${SITE}/og-image.svg`;
  if (!html.includes('og:image')) {
    html = html.replace(/<meta property="og:site_name"/, () => `<meta property="og:image" content="${ogImage}">\n  <meta property="og:site_name"`);
  }
  if (!html.includes('twitter:image')) {
    html = html.replace(/<meta name="twitter:description"/, () => `<meta name="twitter:image" content="${ogImage}">\n  <meta name="twitter:description"`);
  }

  // Replace JSON-LD
  html = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, () => `<script type="application/ld+json">${jsonLd}</script>`);

  const outDir = join(DIST, "skills", id);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "index.html"), html);
  count++;
}

console.log(`Generated ${count} skill pages + 404.html -> dist/`);
