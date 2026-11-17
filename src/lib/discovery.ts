// Agent Skills Discovery index, RFC v0.2.0:
// https://github.com/cloudflare/agent-skills-discovery-rfc
//
// Served identically at /.well-known/agent-skills/index.json (the v0.2.0 path)
// and /.well-known/skills/index.json (the v0.1.0 path, kept so existing links
// and installs keep resolving).
//
// Each entry is one artifact with a digest of its exact bytes:
//   - SKILL.md only            → type "skill-md", url …/{name}/SKILL.md
//   - SKILL.md + other files   → type "archive",  url …/{name}.zip
//
// Legacy fields: every entry also carries `files` and `hash`, the v0.1.0
// fields read by the autosync-ic-skills sync script. That script is copied
// into users' projects once and never updated. Without these fields it sees
// no file list, downloads nothing, and replaces each installed skill with an
// empty directory. v0.2.0 clients MUST ignore unrecognized fields, so carrying
// them is conformant. Drop them only once installed scripts no longer read them.

import path from 'node:path';
import { absUrl } from './site';
import { getAllSkills, getSkillFiles, getSkillHash, getSkillRawMarkdown, type Skill } from './skills';
import { buildSkillZip, sha256Digest } from './skill-zip.js';

export const DISCOVERY_SCHEMA = 'https://schemas.agentskills.io/discovery/0.2.0/schema.json';
/** Where v0.2.0 artifacts live. */
export const DISCOVERY_BASE = '/.well-known/agent-skills';
/** v0.1.0 per-file location, still served for installed sync scripts and old links. */
export const LEGACY_BASE = '/.well-known/skills';

export interface DiscoveryEntry {
  name: string;
  type: 'skill-md' | 'archive';
  description: string;
  url: string;
  digest: string;
  /** Legacy (v0.1.0): files under LEGACY_BASE/{name}/. */
  files: string[];
  /** Legacy (v0.1.0): aggregate hash over files, see getSkillHash. */
  hash: string;
}

export interface DiscoveryIndex {
  $schema: string;
  skills: DiscoveryEntry[];
}

function skillDir(skill: Skill): string {
  const rel = skill.filePath ?? `skills/${skill.id}/SKILL.md`;
  return path.dirname(path.resolve(process.cwd(), rel));
}

const zips = new Map<string, Promise<Buffer>>();
/** The skill's archive, built once per build (every route serves the same bytes). */
export function getSkillZip(skill: Skill): Promise<Buffer> {
  let zip = zips.get(skill.id);
  if (!zip) {
    zip = buildSkillZip(skillDir(skill));
    zips.set(skill.id, zip);
  }
  return zip;
}

let index: Promise<DiscoveryIndex> | null = null;
export function getDiscoveryIndex(): Promise<DiscoveryIndex> {
  index ??= (async () => {
    const skills = await getAllSkills();
    const entries = await Promise.all(
      skills.map(async (s): Promise<DiscoveryEntry> => {
        const files = await getSkillFiles(s);
        const name = s.data.name;
        const archive = files.length > 1;
        const bytes = archive ? await getSkillZip(s) : Buffer.from(await getSkillRawMarkdown(s), 'utf8');
        return {
          name,
          type: archive ? 'archive' : 'skill-md',
          description: s.data.description,
          url: absUrl(archive ? `${DISCOVERY_BASE}/${name}.zip` : `${DISCOVERY_BASE}/${name}/SKILL.md`),
          digest: sha256Digest(bytes),
          files,
          hash: await getSkillHash(s),
        };
      }),
    );
    entries.sort((a, b) => a.name.localeCompare(b.name));
    return { $schema: DISCOVERY_SCHEMA, skills: entries };
  })();
  return index;
}

export async function discoveryIndexResponse(): Promise<Response> {
  return new Response(JSON.stringify(await getDiscoveryIndex(), null, 2) + '\n', {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
