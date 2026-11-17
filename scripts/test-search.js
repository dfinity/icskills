#!/usr/bin/env node
// Regression test for the site's skill search. Builds the same index the site
// serves at /api/search-index.json (from SKILL.md frontmatter and bodies) and
// checks every query in scripts/data/search-cases.json ranks its skill high enough
// and, where a case sets max/absent, that irrelevant skills stay out.
//
//   node scripts/test-search.js            # run all cases
//   node scripts/test-search.js "dns"      # show the ranking for one query

import { readFileSync } from "fs";
import { join } from "path";
import { readAllSkills, ROOT } from "./lib/parse-skill.js";
import { buildSearchDoc, searchDocs } from "../src/lib/search-core.js";

const skills = readAllSkills();
const skillIds = skills.map((s) => s.dir);
const docs = skills.map((s) =>
  buildSearchDoc({
    id: s.dir,
    url: `/skills/${s.dir}/`,
    title: s.meta.title ?? s.dir,
    category: s.meta.category ?? "",
    summary: s.meta.summary ?? "",
    keywords: s.meta.keywords ?? "",
    description: s.meta.description ?? "",
    body: s.body,
    skillIds,
  })
);
// Ecosystem skills, as in src/pages/api/search-index.json.ts: the test must
// rank against exactly the index the site serves.
const community = JSON.parse(readFileSync(join(ROOT, "community", "index.json"), "utf8"));
for (const c of community) {
  docs.push(buildSearchDoc({ id: c.name, url: c.github, title: c.title, category: "Ecosystem", summary: c.description, description: c.description, external: true }));
}

const adhoc = process.argv.slice(2).join(" ");
if (adhoc) {
  const results = searchDocs(docs, adhoc);
  if (!results.length) console.log("(no results)");
  results.forEach((r, i) => console.log(`${String(i + 1).padStart(2)}. ${r.doc.id.padEnd(36)} ${r.score.toFixed(2)}`));
  process.exit(0);
}

const { cases } = JSON.parse(readFileSync(join(ROOT, "scripts", "data", "search-cases.json"), "utf8"));
const failures = [];
for (const c of cases) {
  const ids = searchDocs(docs, c.q).map((r) => r.doc.id);
  const rank = ids.indexOf(c.expect) + 1;
  if (rank === 0 || rank > c.within) {
    failures.push(
      `"${c.q}": expected ${c.expect} within top ${c.within}, got ${rank ? `rank ${rank}` : "no match"} — top: ${ids.slice(0, 3).join(", ") || "(none)"}`
    );
  }
  if (c.max && ids.length > c.max) {
    failures.push(`"${c.q}": ${ids.length} results, at most ${c.max} allowed — ${ids.join(", ")}`);
  }
  for (const id of c.absent ?? []) {
    if (ids.includes(id)) failures.push(`"${c.q}": ${id} must not appear (rank ${ids.indexOf(id) + 1})`);
  }
}

if (failures.length) {
  console.error(`\nSEARCH CASES FAILED (${failures.length}/${cases.length}):`);
  failures.forEach((f) => console.error(`  ✗ ${f}`));
  console.error(`\nDebug one with: node scripts/test-search.js "<query>"`);
  process.exit(1);
}
console.log(`✓ Search cases passed (${cases.length})`);
