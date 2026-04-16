// Serves /skills/<slug>/references/<path> at build time
// Mirrors the .well-known catch-all route for skill reference files.
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
    params: { slug: e.name, path: e.path },
    props: { content: e.content, filePath: e.path },
  }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.content, {
    headers: { 'Content-Type': getContentType(props.filePath) },
  });
};
