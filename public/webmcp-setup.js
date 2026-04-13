/**
 * IC Skills WebMCP setup — registers list_skills, get_skill, and search_skills
 * with navigator.modelContext so AI agents (Chrome 146+, @dfinity/webmcp
 * polyfill, WebMCP-aware browser extensions) can call them as tools.
 *
 * This script uses the site's existing /.well-known/skills/ static endpoints,
 * so it works without a deployed skills canister. When the skills canister
 * (PR #148) is deployed and @dfinity/webmcp is published to npm, this script
 * can be replaced with the full ICWebMCP integration from webmcp.json.
 *
 * Discovery: <link rel="modelcontext" href="/.well-known/webmcp.json"> in the
 * page head signals Chrome 146+ to load the manifest automatically.
 */
(function () {
  "use strict";

  // Install navigator.modelContext polyfill for non-Chrome-146+ environments.
  if (typeof navigator !== "undefined" && !navigator.modelContext) {
    var _registry = new Map();
    Object.defineProperty(navigator, "modelContext", {
      value: {
        registerTool: function (tool) {
          _registry.set(tool.name, tool);
          return Promise.resolve();
        },
        unregisterTool: function (name) {
          _registry.delete(name);
          return Promise.resolve();
        },
        _registry: _registry,
      },
      writable: true,
      configurable: true,
    });
  }

  if (typeof navigator === "undefined" || !navigator.modelContext) return;

  var ctx = navigator.modelContext;

  ctx.registerTool({
    name: "list_skills",
    description:
      "List all available Internet Computer skill topics with their " +
      "names, titles, descriptions, and categories.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    execute: function () {
      return fetch("/.well-known/skills/index.json").then(function (r) {
        return r.json();
      });
    },
  });

  ctx.registerTool({
    name: "get_skill",
    description:
      'Get the full documentation for a specific IC skill by name ' +
      '(e.g. "motoko", "asset-canister", "internet-identity"). ' +
      "Returns the complete SKILL.md content. Returns null if not found.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            'Skill name in lowercase-hyphenated format, ' +
            'e.g. "motoko", "ckbtc", "https-outcalls", "webmcp"',
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
    execute: function (params) {
      var url =
        "/.well-known/skills/" +
        encodeURIComponent(params.name) +
        "/SKILL.md";
      return fetch(url).then(function (r) {
        return r.ok ? r.text() : null;
      });
    },
  });

  ctx.registerTool({
    name: "search_skills",
    description:
      "Search Internet Computer skill documentation by keyword. " +
      "Matches against skill names and descriptions. " +
      "Returns summaries of matching skills.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword to match against skill names and descriptions",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    execute: function (params) {
      return fetch("/.well-known/skills/index.json")
        .then(function (r) {
          return r.json();
        })
        .then(function (data) {
          var q = String(params.query).toLowerCase();
          return {
            skills: data.skills.filter(function (s) {
              return (
                s.name.toLowerCase().includes(q) ||
                s.description.toLowerCase().includes(q)
              );
            }),
          };
        });
    },
  });
})();
