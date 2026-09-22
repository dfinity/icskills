// Generates /.well-known/webmcp.json at build time.
// Implements the WebMCP manifest format consumed by @dfinity/webmcp and
// Chrome 146+ navigator.modelContext to expose IC canister tools to AI agents.
//
// Set SKILLS_CANISTER_ID at build time to embed the deployed canister principal.
// Without it the manifest is generated with a placeholder and must be rebuilt
// after the skills canister is deployed.
//
// Example:
//   SKILLS_CANISTER_ID=abcde-efghi-... npm run build
import type { APIRoute } from "astro";

const CANISTER_ID: string =
  (import.meta.env.SKILLS_CANISTER_ID as string | undefined) ?? "";

const DESCRIPTION =
  "Query Internet Computer skill documentation. Covers Motoko, Rust canisters, " +
  "ckBTC, Internet Identity, stable memory, HTTPS outcalls, EVM RPC, SNS, " +
  "asset canisters, WebMCP, custom domains, and more.";

const manifest = {
  schema_version: "1.0",
  canister: {
    ...(CANISTER_ID ? { id: CANISTER_ID } : {}),
    name: "IC Skills",
    description: DESCRIPTION,
  },
  tools: [
    {
      name: "list_skills",
      description:
        "List all available Internet Computer skill topics with their names, " +
        "titles, descriptions, and categories.",
      canister_method: "list_skills",
      method_type: "query",
      certified: true,
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
    },
    {
      name: "get_skill",
      description:
        "Get the full documentation for a specific IC skill by name " +
        "(e.g. 'motoko', 'asset-canister', 'internet-identity'). " +
        "Returns the complete SKILL.md content plus metadata.",
      canister_method: "get_skill",
      method_type: "query",
      certified: true,
      inputSchema: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description:
              "Skill name in lowercase-hyphenated format, " +
              "e.g. 'motoko', 'ckbtc', 'https-outcalls', 'webmcp'",
          },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
    {
      name: "search_skills",
      description:
        "Search Internet Computer skill documentation by keyword. " +
        "Matches against skill names, titles, descriptions, and full content. " +
        "Returns summaries of matching skills.",
      canister_method: "search_skills",
      method_type: "query",
      certified: true,
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Keyword to match against skill names, titles, descriptions, " +
              "and full content",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  ],
};

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(manifest, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
};
