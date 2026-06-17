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
  // This route already lives under `references/`, so the catch-all `[...path]`
  // must be the path *relative to* `references/`. Passing the full `references/<...>`
  // path doubles the segment, emitting `/skills/<slug>/references/references/<...>`
  // and 404ing the documented `/skills/<slug>/references/<...>` URL.
  const prefix = 'references/';
  return entries
    .filter((e) => e.path.startsWith(prefix))
    .map((e) => ({
      params: { slug: e.name, path: e.path.slice(prefix.length) },
      props: { content: e.content, filePath: e.path },
    }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response(props.content, {
    headers: { 'Content-Type': getContentType(props.filePath) },
  });
};
