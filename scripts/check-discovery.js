#!/usr/bin/env node
// Conformance check for the built Agent Skills Discovery index (RFC v0.2.0,
// https://github.com/cloudflare/agent-skills-discovery-rfc). Run after
// `npm run build`; reads dist/.
//
// Checks, for /.well-known/agent-skills/index.json:
//   - /.well-known/skills/index.json serves the identical index
//   - $schema is the v0.2.0 URI; skill names are unique
//   - every entry: name (1-64, a-z0-9, single inner hyphens), type, description
//     (1-1024 chars), url, digest (sha256:<64 hex>)
//   - digest == SHA-256 of the exact file served at url
//   - skill-md: the served SKILL.md is byte-identical to the source
//   - archive: rebuilding it in THIS process gives the same bytes. CI runs this
//     in a different time zone from the build, so a time-dependent archive (a
//     digest that changes every deploy) fails here. Its file names are relative,
//     with SKILL.md first and no "..".
//   - legacy v0.1.0 fields (files, hash) are present and each listed file is
//     served under /.well-known/skills/<name>/, for installed autosync scripts.

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { ROOT } from "./lib/parse-skill.js";
import { buildSkillZip, listSkillFiles, sha256Digest } from "../src/lib/skill-zip.js";

const DIST = join(ROOT, "dist");
const SCHEMA = "https://schemas.agentskills.io/discovery/0.2.0/schema.json";
const NAME = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const DIGEST = /^sha256:[0-9a-f]{64}$/;

const errors = [];
const fail = (msg) => errors.push(msg);
const distPath = (url) => join(DIST, decodeURIComponent(new URL(url, "https://site.invalid/.well-known/agent-skills/index.json").pathname));

const v2Path = join(DIST, ".well-known/agent-skills/index.json");
const v1Path = join(DIST, ".well-known/skills/index.json");
if (!existsSync(v2Path)) {
  console.error(`✗ ${v2Path} not found — run npm run build first`);
  process.exit(1);
}
const raw = readFileSync(v2Path);
if (!existsSync(v1Path) || !readFileSync(v1Path).equals(raw)) {
  fail("/.well-known/skills/index.json must serve the same bytes as /.well-known/agent-skills/index.json");
}

const index = JSON.parse(raw.toString("utf8"));
if (index.$schema !== SCHEMA) fail(`$schema is ${JSON.stringify(index.$schema)}, expected ${SCHEMA}`);
if (!Array.isArray(index.skills) || index.skills.length === 0) fail("skills must be a non-empty array");

const seen = new Set();
for (const e of index.skills ?? []) {
  const label = e.name ?? "(unnamed)";
  if (typeof e.name !== "string" || e.name.length < 1 || e.name.length > 64 || !NAME.test(e.name)) {
    fail(`${label}: invalid name`);
  }
  if (seen.has(e.name)) fail(`${label}: duplicate name`);
  seen.add(e.name);
  if (e.type !== "skill-md" && e.type !== "archive") fail(`${label}: type must be "skill-md" or "archive", got ${JSON.stringify(e.type)}`);
  if (typeof e.description !== "string" || e.description.length < 1 || e.description.length > 1024) {
    fail(`${label}: description must be 1-1024 characters (got ${e.description?.length})`);
  }
  if (typeof e.digest !== "string" || !DIGEST.test(e.digest)) fail(`${label}: digest must be sha256:<64 lowercase hex>`);
  if (typeof e.url !== "string") { fail(`${label}: missing url`); continue; }

  const served = distPath(e.url);
  if (!existsSync(served)) { fail(`${label}: url ${e.url} is not served (no ${served})`); continue; }
  const bytes = readFileSync(served);
  if (sha256Digest(bytes) !== e.digest) fail(`${label}: digest does not match the bytes served at ${e.url}`);

  const skillDir = join(ROOT, "skills", e.name);
  const files = existsSync(skillDir) ? listSkillFiles(skillDir) : [];
  if (e.type === "skill-md") {
    if (files.length !== 1) fail(`${label}: has ${files.length} files, so it must be type "archive"`);
    if (!bytes.equals(readFileSync(join(skillDir, "SKILL.md")))) fail(`${label}: served SKILL.md differs from skills/${e.name}/SKILL.md`);
  } else {
    if (files.length < 2) fail(`${label}: has only SKILL.md, so it should be type "skill-md"`);
    if (files[0] !== "SKILL.md") fail(`${label}: archive must have SKILL.md at its root`);
    for (const f of files) {
      if (f.startsWith("/") || f.split("/").includes("..")) fail(`${label}: unsafe archive path ${f}`);
    }
    const rebuilt = await buildSkillZip(skillDir);
    if (!rebuilt.equals(bytes)) {
      fail(`${label}: archive is not reproducible (rebuilt in ${Intl.DateTimeFormat().resolvedOptions().timeZone}, bytes differ)`);
    }
  }

  // Legacy v0.1.0 fields, still read by installed autosync-ic-skills scripts.
  if (!Array.isArray(e.files) || e.files.length === 0) fail(`${label}: legacy files[] missing (installed sync scripts would empty this skill)`);
  if (typeof e.hash !== "string" || !DIGEST.test(e.hash)) fail(`${label}: legacy hash missing`);
  for (const f of e.files ?? []) {
    if (!existsSync(join(DIST, ".well-known/skills", e.name, f))) fail(`${label}: legacy file ${f} not served under /.well-known/skills/${e.name}/`);
  }
}

if (errors.length) {
  console.error(`\nDISCOVERY INDEX CHECK FAILED (${errors.length}):`);
  errors.forEach((m) => console.error(`  ✗ ${m}`));
  process.exit(1);
}
const types = index.skills.reduce((c, e) => ({ ...c, [e.type]: (c[e.type] ?? 0) + 1 }), {});
console.log(`✓ Discovery index conforms to v0.2.0 (${index.skills.length} skills: ${types["skill-md"] ?? 0} skill-md, ${types.archive ?? 0} archive)`);
