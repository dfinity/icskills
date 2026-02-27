// Static data constants — identical to the original app.jsx

export const SANS_FONT = "'Inter', system-ui, sans-serif";

export const API_ENDPOINTS = [
  {
    method: "GET",
    path: "/skills",
    desc: "All skills, with metadata.",
    response: `{
  "skills": [
    {
      "id": "ckbtc",
      "name": "ckBTC Integration",
      "version": "2.1.0",
      "category": "defi",
      "dependencies": ["icrc-ledger", "wallet"],
      "updated": "2026-02-24"
    },
    ...
  ]
}`,
  },
  {
    method: "GET",
    path: "/skills/{id}",
    desc: "Full skill. This is the main one.",
    response: `{
  "id": "ckbtc",
  "version": "2.1.0",
  "what": "ckBTC is chain-key Bitcoin on the IC...",
  "prerequisites": {
    "icp-cli": ">=0.1.0",
    "language": ["motoko", "rust"],
    "skills": ["icrc-ledger", "wallet"]
  },
  "pitfalls": [
    "DO NOT use the old minter canister ID",
    "Fee is 10 satoshis, not 0",
    "Must use subaccounts for user deposits"
  ],
  "steps": [...],
  "verification": [
    {
      "run": "icp canister call ckbtc_ledger icrc1_balance_of ...",
      "expect": "(nat)"
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/skills/{id}/raw",
    desc: "Raw SKILL.md. Drop it straight into agent context.",
    response: `# ckBTC Integration
## SKILL.md v2.1.0

## What this is
ckBTC is chain-key Bitcoin...

## Prerequisites
- icp-cli >= 0.1.0
...

## \u26A0 Agent Mistakes
- DO NOT use the old minter canister ID
...`,
  },
  {
    method: "GET",
    path: "/skills/{id}/deps",
    desc: "Dependency tree. What else the agent needs to read first.",
    response: `{
  "skill": "ckbtc",
  "requires": ["icrc-ledger", "wallet"],
  "tree": {
    "icrc-ledger": { "requires": [] },
    "wallet": { "requires": [] }
  }
}`,
  },
  {
    method: "GET",
    path: "/skills/search?q={query}",
    desc: "Search. For when the agent knows the task but not the skill name.",
    response: `{
  "query": "bitcoin",
  "results": [
    { "id": "ckbtc", "name": "ckBTC Integration", "relevance": 0.97 },
    { "id": "evm-rpc", "name": "EVM RPC Integration", "relevance": 0.31 }
  ]
}`,
  },
  {
    method: "POST",
    path: "/skills/batch",
    desc: "Multiple skills in one call. Send an array of IDs.",
    response: `// Request body:
{ "ids": ["ckbtc", "icrc-ledger", "wallet"] }

// Response:
{
  "skills": [
    { "id": "ckbtc", "version": "2.1.0", ... },
    { "id": "icrc-ledger", "version": "2.3.0", ... },
    { "id": "wallet", "version": "1.4.0", ... }
  ]
}`,
  },
];

export const FRAMEWORKS = [
  { name: "Claude", note: "Skills as context", color: "#D97757" },
  { name: "ChatGPT", note: "Function calling", color: "#10a37f" },
  { name: "Cursor", note: "Rules files", color: "#ffffff" },
  { name: "Devin", note: "Knowledge base", color: "#9F7AEA" },
  { name: "Copilot", note: "Custom instructions", color: "#0078D4" },
  { name: "Windsurf", note: "Cascade context", color: "#06B6D4" },
  { name: "Claude Code", note: "SKILL.md files", color: "#D97757" },
  { name: "OpenCode", note: "Remote instructions", color: "#00DC82" },
  { name: "OpenClaw", note: "Skills marketplace", color: "#EF4444" },
  { name: "Your Agent", note: "REST API", color: "#fbbf24" },
];

export const FW_LIGHT_COLORS: Record<string, string> = {
  Cursor: "#1a1a2e",
  Devin: "#7c3aed",
  Windsurf: "#0891b2",
  OpenCode: "#059669",
  OpenClaw: "#dc2626",
  "Your Agent": "#d97706",
};
