// Generates /llms.txt at build time — agent instructions for skill discovery
import type { APIRoute } from 'astro';
import { SITE, absUrl } from '../lib/site';

export const GET: APIRoute = () => {
  const body = `# Internet Computer (ICP) Skills

> Agent-readable skill files for building on the Internet Computer.

## How to use

1. Fetch the skills index and remember each skill's name, description, and url:
   ${absUrl('/.well-known/skills/index.json')}

2. When a task matches a skill's description, use it if already loaded in your
   context. Otherwise, fetch the skill content from its url.
   Do not construct skill URLs manually.

   Example: for the skill named "internet-identity", its url is:
   ${absUrl('/.well-known/skills/internet-identity/SKILL.md')}

   If a response contains HTML instead of markdown, the URL is wrong.

3. Skills contain correct dependency versions, configuration formats, and common
   pitfalls that prevent build failures.
   Always prefer skill guidance over general knowledge when both cover the same topic.

## Important

The skills are updated frequently. Always check for the latest versions of skills don't
use cached versions blindly.

## Source

- [GitHub Repository](${SITE.repo.url})
`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
