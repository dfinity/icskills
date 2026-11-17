// Reproducible skill archives for the Agent Skills Discovery RFC v0.2.0.
//
// The discovery index publishes a SHA-256 `digest` of each archive, and clients
// MUST reject an archive whose bytes don't match it. So the same skill files
// must always produce the same bytes: on every build, on any machine, in any
// time zone. Otherwise every deploy would publish new digests for unchanged
// skills and force every client to re-download them.
//
// Plain JS (like search-core.js) so scripts/check-discovery.js can rebuild an
// archive in Node and compare it byte for byte with what the site serves.

import { ZipArchive } from 'archiver';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Every entry gets this timestamp instead of the build time. zip-stream writes
// it in UTC (forceLocalTime defaults to false), so the time zone can't change it.
const FIXED_DATE = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));

/**
 * Files in a skill directory, relative and '/'-separated, SKILL.md first, then
 * sorted. Dotfiles and dot-directories are skipped (matching getSkillFiles).
 */
export function listSkillFiles(skillDir) {
  const out = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) out.push(relative(skillDir, full).split(sep).join('/'));
    }
  };
  walk(skillDir);
  return ['SKILL.md', ...out.filter((f) => f !== 'SKILL.md').sort()];
}

/**
 * Build the archive for a skill directory. Files sit at the archive root (the
 * spec forbids a wrapper directory), SKILL.md first. scripts/ files are marked
 * executable; everything else is read-only for group and other.
 * @returns {Promise<Buffer>}
 */
export function buildSkillZip(skillDir) {
  return new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const chunks = [];
    archive.on('data', (chunk) => chunks.push(chunk));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const file of listSkillFiles(skillDir)) {
      archive.append(readFileSync(join(skillDir, file)), {
        name: file,
        date: FIXED_DATE,
        mode: file.startsWith('scripts/') ? 0o755 : 0o644,
      });
    }
    archive.finalize();
  });
}

/** `sha256:<64 lowercase hex>`, the RFC v0.2.0 digest format. */
export function sha256Digest(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}
