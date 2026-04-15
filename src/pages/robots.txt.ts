// /robots.txt — explicitly welcomes indexing and points at both sitemap
// and llms.txt so crawlers discover every representation.

import type { APIRoute } from 'astro';
import { SITE, absUrl } from '../lib/site';

export const GET: APIRoute = () => {
  const body = [
    '# Every page on this site is public, static, and safe to crawl.',
    'User-agent: *',
    'Allow: /',
    '',
    `Sitemap: ${absUrl('/sitemap-index.xml')}`,
    `# LLM discovery (llmstxt.org convention):`,
    `# ${absUrl('/llms.txt')}`,
    `# ${absUrl('/llms-full.txt')}`,
    '',
    `# Publisher: ${SITE.author.name} (${SITE.author.url})`,
    `# Source: ${SITE.repo.url}`,
    '',
  ].join('\n');
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
