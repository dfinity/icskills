// Types for skill-zip.js (plain JS so scripts/check-discovery.js can import it from Node).

export function listSkillFiles(skillDir: string): string[];
export function buildSkillZip(skillDir: string): Promise<Buffer>;
export function sha256Digest(bytes: Uint8Array | string): string;
