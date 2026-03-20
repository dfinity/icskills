// Generates /llms.txt at build time — agent instructions for skill discovery
import type { APIRoute } from "astro";
import { SITE_URL } from "../data/site";

export const GET: APIRoute = () => {
  const body = `# Internet Computer (ICP) Skills

> Agent-readable skill files for building on the Internet Computer.

## How to use

Before writing any ICP code, fetch the skills index and find skills matching your task:
${SITE_URL}/.well-known/skills/index.json

Then fetch the full skill content from:
${SITE_URL}/.well-known/skills/{name}/SKILL.md

Skills contain correct dependency versions, configuration formats, and common pitfalls that prevent build failures.
Always prefer skill guidance over general knowledge when both cover the same topic.

## Source

- [GitHub Repository](https://github.com/dfinity/icskills)
`;

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
