// /.well-known/skills/index.json: the v0.1.0 path of the Agent Skills Discovery
// RFC. It now serves the same v0.2.0 index as /.well-known/agent-skills/index.json
// so existing links and installs keep resolving. See src/lib/discovery.ts.
import type { APIRoute } from 'astro';
import { discoveryIndexResponse } from '../../../lib/discovery';

export const GET: APIRoute = () => discoveryIndexResponse();
