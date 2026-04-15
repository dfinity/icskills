// Serves /.well-known/skills/<name>/<path> at build time
// Catch-all route for skill files (references, scripts, etc.)
// SKILL.md is handled by its own dedicated route.
// Implements the Cloudflare Agent Skills Discovery RFC (v0.1)
// https://github.com/cloudflare/agent-skills-discovery-rfc
import type { APIRoute } from 'astro';
import { getSkillFileEntries } from '../../../../lib/skills';

function getContentType(path: string): string {
  if (path.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  return 'text/plain; charset=utf-8';
}

export async function getStaticPaths() {
  const entries = await getSkillFileEntries();
  return entries.map((e) => ({
    params: { name: e.name, path: e.path },
    props: { content: e.content, filePath: e.path },
  }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.content, {
    headers: { 'Content-Type': getContentType(props.filePath) },
  });
};
