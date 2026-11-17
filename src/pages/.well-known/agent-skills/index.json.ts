// /.well-known/agent-skills/index.json: Agent Skills Discovery RFC v0.2.0.
// https://github.com/cloudflare/agent-skills-discovery-rfc
// See src/lib/discovery.ts for the entry format and digests.
import type { APIRoute } from 'astro';
import { discoveryIndexResponse } from '../../../lib/discovery';

export const GET: APIRoute = () => discoveryIndexResponse();
