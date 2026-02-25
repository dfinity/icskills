import { useState, useEffect } from "preact/hooks";

const SKILLS = [
  {
    id: "ckbtc",
    name: "ckBTC Integration",
    category: "DeFi",
    description: "Accept, send, and manage ckBTC in your canister. Covers minting, transfers, balance checks, and UTXO management.",
    endpoints: 14,
    lastUpdated: "2026-02-24",
    version: "2.1.0",
    status: "stable",
    dependencies: ["icrc-ledger", "wallet"],
  },
  {
    id: "multi-canister",
    name: "Multi-Canister Architecture",
    category: "Architecture",
    description: "Design and deploy multi-canister dapps with inter-canister calls, shared state patterns, and upgrade strategies.",
    endpoints: 8,
    lastUpdated: "2026-02-24",
    version: "3.0.1",
    status: "stable",
    dependencies: ["stable-memory"],
  },
  {
    id: "internet-identity",
    name: "Internet Identity Auth",
    category: "Auth",
    description: "Integrate Internet Identity authentication into frontend and backend canisters. Delegation, session management, and anchor handling.",
    endpoints: 6,
    lastUpdated: "2026-02-24",
    version: "4.0.0",
    status: "stable",
    dependencies: ["asset-canister"],
  },
  {
    id: "icrc-ledger",
    name: "ICRC Ledger Standard",
    category: "Tokens",
    description: "Deploy and interact with ICRC-1/ICRC-2 token ledgers. Minting, approvals, transfers, and metadata.",
    endpoints: 11,
    lastUpdated: "2026-02-24",
    version: "2.3.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "https-outcalls",
    name: "HTTPS Outcalls",
    category: "Integration",
    description: "Make HTTP requests from canisters to external APIs. Consensus-safe request patterns, transform functions, and cost management.",
    endpoints: 4,
    lastUpdated: "2026-02-24",
    version: "1.5.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "sns-launch",
    name: "SNS DAO Launch",
    category: "Governance",
    description: "Configure and launch an SNS DAO. Token economics, proposal types, nervous system parameters, and decentralization swap.",
    endpoints: 22,
    lastUpdated: "2026-02-24",
    version: "1.8.0",
    status: "stable",
    dependencies: ["icrc-ledger", "multi-canister"],
  },
  {
    id: "asset-canister",
    name: "Asset Canister & Frontend",
    category: "Frontend",
    description: "Deploy frontend assets to the IC. Certified assets, custom domains, SPA routing, and content encoding.",
    endpoints: 5,
    lastUpdated: "2026-02-24",
    version: "3.2.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "stable-memory",
    name: "Stable Memory & Upgrades",
    category: "Architecture",
    description: "Manage canister state across upgrades. Stable structures, pre/post upgrade hooks, and memory-mapped data.",
    endpoints: 6,
    lastUpdated: "2026-02-24",
    version: "2.0.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "wallet",
    name: "Cycles Wallet Management",
    category: "Infrastructure",
    description: "Create, fund, and manage cycles wallets. Top-up canisters, check balances, and automate cycle management.",
    endpoints: 7,
    lastUpdated: "2026-02-24",
    version: "1.4.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "vetkd",
    name: "vetKD Encryption",
    category: "Security",
    description: "Implement on-chain encryption using vetKD. Key derivation, encryption/decryption flows, and access control patterns.",
    endpoints: 5,
    lastUpdated: "2026-02-24",
    version: "0.9.0",
    status: "beta",
    dependencies: ["internet-identity"],
  },
  {
    id: "certified-variables",
    name: "Certified Variables",
    category: "Security",
    description: "Serve verified responses from query calls. Merkle tree construction, certificate validation, and certified asset patterns.",
    endpoints: 4,
    lastUpdated: "2026-02-24",
    version: "1.2.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "evm-rpc",
    name: "EVM RPC Integration",
    category: "Integration",
    description: "Call Ethereum and EVM chains from IC canisters. JSON-RPC, transaction signing, and cross-chain workflows.",
    endpoints: 9,
    lastUpdated: "2026-02-24",
    version: "1.1.0",
    status: "stable",
    dependencies: ["https-outcalls"],
  },
];

const CATEGORIES = ["All", "Architecture", "Auth", "DeFi", "Frontend", "Governance", "Infrastructure", "Integration", "Security", "Tokens"];

const SANS_FONT = "'Inter', system-ui, sans-serif";

const TOTAL_ENDPOINTS = SKILLS.reduce((sum, s) => sum + s.endpoints, 0);

const API_ENDPOINTS = [
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
    "dfx": ">=0.24.0",
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
      "run": "dfx canister call ckbtc_ledger icrc1_balance_of ...",
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
- dfx >= 0.24.0
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

const FRAMEWORKS = [
  { name: "Claude", note: "Skills as context", color: "#D97757" },
  { name: "ChatGPT", note: "Function calling", color: "#10a37f" },
  { name: "Cursor", note: "Rules files", color: "#ffffff" },
  { name: "Devin", note: "Knowledge base", color: "#9F7AEA" },
  { name: "Copilot", note: "Custom instructions", color: "#0078D4" },
  { name: "Windsurf", note: "Cascade context", color: "#06B6D4" },
  { name: "Claude Code", note: "SKILL.md files", color: "#D97757" },
  { name: "Your Agent", note: "REST API", color: "#fbbf24" },
];

const FW_LIGHT_COLORS = {
  Cursor: "#1a1a2e",
  Devin: "#7c3aed",
  Windsurf: "#0891b2",
  "Your Agent": "#d97706",
};

function FrameworkIcon({ name, size = 20, color }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", style: { color } };
  switch (name) {
    case "Claude":
      return (<svg {...s} fill="currentColor"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>);
    case "ChatGPT":
      return (<svg {...s} fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.14-.08 4.778-2.758a.795.795 0 0 0 .393-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.814 3.354-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.856L13.104 8.364l2.015-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.098-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>);
    case "Cursor":
      return (<svg {...s} fill="none"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0" fill="currentColor" opacity="0.15"/><path d="M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" fill="currentColor"/></svg>);
    case "Devin":
      return (<svg {...s} fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 12H16M12 8V16" strokeLinecap="round"/></svg>);
    case "Copilot":
      return (<svg {...s} fill="currentColor"><path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256zm-9.422 1.258c.549 0 1-.451 1-1v-2c0-.549-.451-1-1-1-.549 0-1 .451-1 1v2c0 .549.451 1 1 1zm-5 0c.549 0 1-.451 1-1v-2c0-.549-.451-1-1-1-.549 0-1 .451-1 1v2c0 .549.451 1 1 1z"/></svg>);
    case "Windsurf":
      return (<svg {...s} fill="currentColor"><path d="M23.55 5.067c-1.204-.002-2.181.973-2.181 2.177v4.867c0 .972-.803 1.76-1.76 1.76-.568 0-1.135-.286-1.472-.766l-4.971-7.1c-.413-.59-1.084-.941-1.81-.941-1.134 0-2.154.964-2.154 2.153v4.896c0 .972-.797 1.76-1.76 1.76-.57 0-1.136-.286-1.473-.766L.408 5.16C.282 4.98 0 5.069 0 5.288v4.245c0 .215.066.423.188.6l5.475 7.818c.323.462.8.805 1.351.93 1.377.313 2.644-.747 2.644-2.098v-4.893c0-.972.788-1.76 1.76-1.76h.003c.57 0 1.136.286 1.472.766l4.972 7.1c.414.59 1.05.94 1.81.94 1.158 0 2.151-.964 2.151-2.153v-4.895c0-.972.788-1.759 1.76-1.759h.194a.22.22 0 0 0 .22-.22V5.287a.22.22 0 0 0-.22-.22z"/></svg>);
    case "Claude Code":
      return (<svg {...s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6L3 12L8 18"/><path d="M16 6L21 12L16 18"/><path d="M14 4L10 20" opacity="0.5"/></svg>);
    case "Your Agent":
      return (<svg {...s} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>);
    default:
      return null;
  }
}

function CategoryIcon({ category, size = 18 }) {
  const common = {
    width: size, height: size, viewBox: "0 0 18 18",
    fill: "none", stroke: "currentColor", strokeWidth: "1.5",
    strokeLinecap: "round", strokeLinejoin: "round",
  };
  switch (category) {
    case "Architecture":
      return (<svg {...common}><path d="M9 2L2 6l7 4 7-4z" /><path d="M2 9l7 4 7-4" /><path d="M2 12l7 4 7-4" /></svg>);
    case "Auth":
      return (<svg {...common}><path d="M6 8V5.5a3 3 0 016 0V8" /><path d="M4 8h10a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /></svg>);
    case "DeFi":
      return (<svg {...common}><path d="M2 14l4-5 3 2.5L16 4" /><path d="M12 4h4v4" /></svg>);
    case "Frontend":
      return (<svg {...common}><path d="M2.5 4h13a1 1 0 011 1v9a1 1 0 01-1 1h-13a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M1.5 7h15" /></svg>);
    case "Governance":
      return (<svg {...common}><path d="M2 15h14" /><path d="M4 15V8" /><path d="M9 15V8" /><path d="M14 15V8" /><path d="M2 8l7-5.5 7 5.5" /></svg>);
    case "Infrastructure":
      return (<svg {...common}><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M3.8 14.2l1.4-1.4M12.8 5.2l1.4-1.4" /></svg>);
    case "Integration":
      return (<svg {...common}><path d="M7 11L5 13a2.8 2.8 0 01-4-4l2-2" /><path d="M11 7l2-2a2.8 2.8 0 014 4l-2 2" /><path d="M7 11l4-4" /></svg>);
    case "Security":
      return (<svg {...common}><path d="M9 1.5L3 4.5v4c0 4 2.5 7 6 8.5 3.5-1.5 6-4.5 6-8.5v-4z" /></svg>);
    case "Tokens":
      return (<svg {...common}><path d="M9 2a7 7 0 100 14A7 7 0 009 2z" /><path d="M9 5v8" /><path d="M7 7.5h4" /><path d="M7 10.5h4" /></svg>);
    default:
      return null;
  }
}

function TerminalHeader({ title }) {
  return (
    <div style={{
      padding: "12px 20px",
      background: `rgba(var(--accent-rgb),0.04)`,
      borderBottom: `1px solid rgba(var(--accent-rgb),0.08)`,
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-red)" }} />
      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-yellow)" }} />
      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-green)" }} />
      <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-faint)" }}>{title}</span>
    </div>
  );
}

export function App() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [activeTab, setActiveTab] = useState("browse");
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("ic-skills-theme");
      if (stored) return stored;
      if (window.matchMedia?.("(prefers-color-scheme: light)").matches) return "light";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ic-skills-theme", theme);
  }, [theme]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const query = searchQuery.toLowerCase();
  const filtered = SKILLS.filter((s) => {
    const matchCat = activeCategory === "All" || s.category === activeCategory;
    const matchSearch = s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  const getFwColor = (name) => theme === "light" && FW_LIGHT_COLORS[name] ? FW_LIGHT_COLORS[name] : FRAMEWORKS.find((f) => f.name === name)?.color;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      color: "var(--text-body)",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, opacity: "var(--grid-opacity)",
        backgroundImage: `
          linear-gradient(rgba(var(--accent-rgb),0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(var(--accent-rgb),0.5) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Glow orbs */}
      <div style={{
        position: "fixed", top: "-200px", right: "-200px",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, var(--glow-1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-300px", left: "-100px",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, var(--glow-2) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10,
        borderBottom: `1px solid rgba(var(--accent-rgb),0.12)`,
        padding: "0 32px",
        background: "var(--bg-header)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: "72px",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
            <span style={{
              fontSize: "20px", letterSpacing: "-0.5px",
              color: "var(--text-primary)", lineHeight: 1,
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{
                fontWeight: 900, fontSize: "20px",
                background: "var(--gradient-accent)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>IC</span>
              <span style={{
                width: "1px", height: "18px",
                background: "var(--border-default)",
                display: "inline-block",
              }} />
              <span style={{
                fontWeight: 600, fontSize: "16px",
                color: "var(--text-muted)",
                letterSpacing: "0.5px",
              }}>Skills</span>
            </span>
            <span style={{
              fontSize: "9px", padding: "3px 10px",
              background: `rgba(var(--accent-rgb),0.12)`,
              border: `1px solid rgba(var(--accent-rgb),0.25)`,
              borderRadius: "99px", color: "var(--accent-text)",
              letterSpacing: "1.5px", textTransform: "uppercase",
              fontWeight: 600,
            }}>Agent-First</span>
          </div>
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            {["browse", "how-it-works", "api"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "6px 16px", fontSize: "12px",
                background: activeTab === tab ? `rgba(var(--accent-rgb),0.15)` : "transparent",
                border: activeTab === tab ? `1px solid rgba(var(--accent-rgb),0.3)` : "1px solid transparent",
                borderRadius: "6px",
                color: activeTab === tab ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer", transition: "all 0.2s",
                textTransform: "capitalize",
              }}>
                {tab.replace(/-/g, " ")}
              </button>
            ))}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px", marginLeft: "8px",
                color: "var(--text-faint)",
                display: "flex", alignItems: "center",
              }}
            >
              {theme === "dark" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 10, maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>

        {/* BROWSE TAB */}
        {activeTab === "browse" && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: "48px" }}>
              <div style={{
                fontSize: "11px", color: "var(--accent)", letterSpacing: "3px",
                textTransform: "uppercase", marginBottom: "16px",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ display: "inline-block", width: "24px", height: "1px", background: "var(--accent)" }} />
                Internet Computer Protocol
              </div>
              <h1 style={{
                fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800,
                lineHeight: 1.1, margin: "0 0 16px 0",
                letterSpacing: "-2px",
                background: "var(--gradient-hero)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Skills for agents,<br />not docs for humans.
              </h1>
              <p style={{
                fontSize: "15px", color: "var(--text-tertiary)", maxWidth: "560px",
                lineHeight: 1.6, margin: 0, fontFamily: SANS_FONT,
              }}>
                Structured, versioned, agent-readable skill files for every Internet Computer capability.
                Your AI reads the skill. It builds correctly. No hallucinations.
              </p>

              {/* Stats */}
              <div className="hero-stats" style={{ display: "flex", gap: "32px", marginTop: "32px" }}>
                {[
                  { val: SKILLS.length, label: "Skills" },
                  { val: API_ENDPOINTS.length, label: "API Routes" },
                  { val: TOTAL_ENDPOINTS, label: "Operations" },
                  { val: "0", label: "Hallucinations" },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-1px" }}>{val}</div>
                    <div style={{ fontSize: "11px", color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "2px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Search */}
            <div style={{
              display: "flex", gap: "12px", marginBottom: "24px",
              flexWrap: "wrap", alignItems: "center",
            }}>
              <div style={{ position: "relative", flex: "1 1 300px" }}>
                <span style={{
                  position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)",
                  color: "var(--text-faint)", fontSize: "14px",
                }}>{"\u2315"}</span>
                <input
                  type="text"
                  placeholder="Search skills..."
                  aria-label="Search skills"
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px 12px 38px",
                    background: "var(--bg-input)",
                    border: "1px solid var(--border-strong)",
                    borderRadius: "8px", color: "var(--text-body)",
                    fontSize: "13px", outline: "none",
                    fontFamily: "inherit", boxSizing: "border-box",
                  }}
                />
              </div>
              <div className="endpoint-hint" style={{
                padding: "10px 16px",
                background: `rgba(var(--accent-rgb),0.1)`,
                border: `1px solid rgba(var(--accent-rgb),0.2)`,
                borderRadius: "8px", fontSize: "12px", color: "var(--accent-text)",
                whiteSpace: "nowrap",
              }}>
                fetch("skills.internetcomputer.org/api/v1/skills/{"{"}
                <span style={{ color: "var(--accent-blue)" }}>id</span>
                {"}"}")
              </div>
            </div>

            {/* Category filters */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "32px", flexWrap: "wrap" }}>
              {CATEGORIES.map((cat) => (
                <button key={cat} className="category-pill" onClick={() => setActiveCategory(cat)} style={{
                  padding: "6px 14px", fontSize: "11px",
                  background: activeCategory === cat ? `rgba(var(--accent-rgb),0.15)` : "var(--bg-card)",
                  border: `1px solid ${activeCategory === cat ? `rgba(var(--accent-rgb),0.4)` : "var(--border-default)"}`,
                  borderRadius: "6px",
                  color: activeCategory === cat ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer", letterSpacing: "0.5px",
                  display: "flex", alignItems: "center", gap: "6px",
                }}>
                  {cat !== "All" && <CategoryIcon category={cat} size={14} />}
                  {cat}
                </button>
              ))}
            </div>

            {/* Skills Grid */}
            <div className="skills-grid" style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(min(340px, 100%), 1fr))",
              gap: "16px",
            }}>
              {filtered.map((skill) => (
                <div
                  key={skill.id}
                  className="skill-card"
                  onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                  style={{
                    padding: "24px",
                    background: selectedSkill === skill.id
                      ? `rgba(var(--accent-rgb),0.06)`
                      : "var(--bg-card)",
                    border: `1px solid ${selectedSkill === skill.id ? `rgba(var(--accent-rgb),0.3)` : "var(--border-default)"}`,
                    borderRadius: "12px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <span style={{
                      fontSize: "18px", width: "36px", height: "36px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: `rgba(var(--accent-rgb),0.08)`,
                      borderRadius: "8px", color: "var(--accent-text)",
                      flexShrink: 0,
                    }}><CategoryIcon category={skill.category} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px",
                        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                      }}>
                        {skill.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-faint)", marginTop: "2px" }}>
                        v{skill.version} {"\u00B7"} {skill.category}
                      </div>
                    </div>
                  </div>

                  <p style={{
                    fontSize: "12px", color: "var(--text-dim)", lineHeight: 1.6,
                    margin: "0 0 16px 0", fontFamily: SANS_FONT,
                  }}>{skill.description}</p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontSize: "11px", color: "var(--text-ghost)" }}>
                      {skill.endpoints} operations {"\u00B7"} updated {skill.lastUpdated}
                    </div>
                    {skill.status === "beta" && (
                      <span style={{
                        fontSize: "9px", padding: "2px 6px",
                        background: `rgba(var(--yellow-rgb),0.1)`,
                        border: `1px solid rgba(var(--yellow-rgb),0.2)`,
                        color: "var(--yellow)", borderRadius: "3px",
                        textTransform: "uppercase", letterSpacing: "1px",
                      }}>beta</span>
                    )}
                  </div>

                  {skill.dependencies.length > 0 && (
                    <div style={{
                      marginTop: "12px", paddingTop: "12px",
                      borderTop: "1px solid var(--border-subtle)",
                      display: "flex", gap: "6px", flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: "10px", color: "var(--text-ghost)" }}>requires:</span>
                      {skill.dependencies.map((dep) => (
                        <span key={dep} style={{
                          fontSize: "10px", padding: "2px 8px",
                          background: `rgba(var(--blue-rgb),0.08)`,
                          border: `1px solid rgba(var(--blue-rgb),0.15)`,
                          borderRadius: "3px", color: "var(--accent-blue)",
                        }}>{dep}</span>
                      ))}
                    </div>
                  )}

                  {selectedSkill === skill.id && (() => {
                    const url = `https://skills.internetcomputer.org/api/v1/skills/${skill.id}`;
                    return (
                      <div style={{
                        marginTop: "16px", paddingTop: "16px",
                        borderTop: `1px solid rgba(var(--accent-rgb),0.15)`,
                      }}>
                        <div style={{ fontSize: "11px", color: "var(--accent-text)", marginBottom: "8px" }}>
                          Agent Endpoint:
                        </div>
                        <div style={{ position: "relative" }}>
                          <code style={{
                            display: "block", padding: "12px 40px 12px 16px",
                            background: "var(--bg-code)",
                            border: `1px solid rgba(var(--accent-rgb),0.15)`,
                            borderRadius: "6px", fontSize: "11px", color: "var(--accent)",
                            wordBreak: "break-all",
                          }}>
                            GET {url}
                          </code>
                          <button
                            onClick={(e) => { e.stopPropagation(); copyToClipboard(url); }}
                            title="Copy URL"
                            aria-label="Copy endpoint URL"
                            style={{
                              position: "absolute", top: "8px", right: "8px",
                              background: "none", border: "none",
                              cursor: "pointer", padding: "4px",
                              color: copiedUrl === url ? "var(--green)" : "var(--text-faint)",
                              fontSize: "14px", lineHeight: 1,
                              transition: "color 0.2s",
                            }}
                          >
                            {copiedUrl === url ? "\u2713" : "\u2398"}
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          </>
        )}

        {/* HOW IT WORKS TAB */}
        {activeTab === "how-it-works" && (
          <div style={{ maxWidth: "960px" }}>
            {/* Hero */}
            <div style={{ textAlign: "center", marginBottom: "72px" }}>
              <h2 style={{
                fontSize: "clamp(36px, 6vw, 56px)", fontWeight: 800, color: "var(--text-primary)",
                letterSpacing: "-3px", margin: "0 0 20px 0", lineHeight: 1.05,
              }}>
                <span style={{ color: "var(--text-faint)" }}>Docs are for humans.</span><br />
                <span style={{
                  background: "var(--gradient-accent)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>Skills are for agents.</span>
              </h2>
              <p style={{
                fontSize: "16px", color: "var(--text-faint)", maxWidth: "500px", margin: "0 auto",
                lineHeight: 1.7, fontFamily: SANS_FONT,
              }}>
                One API call. Structured instructions. Zero hallucinations.
              </p>
            </div>

            {/* 3-step flow */}
            <div className="step-grid" style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px",
              marginBottom: "72px",
            }}>
              {[
                { num: "01", title: "Agent fetches skill", code: "GET /api/v1/skills/ckbtc", colorVar: "accent", rgbVar: "accent-rgb",
                  desc: "Agent identifies what it needs to build and pulls the right skill from the API" },
                { num: "02", title: "Reads instructions", code: "{ pitfalls, steps, verify }", colorVar: "accent-blue", rgbVar: "blue-rgb",
                  desc: "Gets structured steps, working code, known pitfalls, and verification checks" },
                { num: "03", title: "Builds correctly", code: "\u2713 deployed & verified", colorVar: "green", rgbVar: "green-rgb",
                  desc: "Executes with zero hallucinations because every detail is precise and tested" },
              ].map(({ num, title, code, colorVar, rgbVar, desc }) => (
                <div key={num} className="step-card" style={{
                  padding: "32px 24px",
                  background: `rgba(var(--${rgbVar}),0.04)`,
                  borderTop: `2px solid var(--${colorVar})`,
                  position: "relative",
                }}>
                  <div style={{
                    fontSize: "48px", fontWeight: 900, color: `var(--${colorVar})`, opacity: 0.12,
                    position: "absolute", top: "16px", right: "16px", lineHeight: 1,
                  }}>{num}</div>
                  <div style={{
                    fontSize: "11px", fontWeight: 700, color: `var(--${colorVar})`,
                    letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px",
                  }}>Step {num}</div>
                  <div style={{
                    fontSize: "18px", fontWeight: 800, color: "var(--text-primary)",
                    letterSpacing: "-0.5px", marginBottom: "8px",
                  }}>{title}</div>
                  <code style={{
                    display: "inline-block", padding: "4px 10px",
                    background: "var(--bg-code)",
                    borderRadius: "4px", fontSize: "11px", color: `var(--${colorVar})`,
                    marginBottom: "12px",
                  }}>{code}</code>
                  <p style={{
                    fontSize: "13px", color: "var(--text-faint)", lineHeight: 1.6, margin: 0,
                    fontFamily: SANS_FONT,
                  }}>{desc}</p>
                </div>
              ))}
            </div>

            {/* Before / After comparison */}
            <div style={{ marginBottom: "72px" }}>
              <div style={{
                fontSize: "11px", color: "var(--text-faint)", letterSpacing: "3px",
                textTransform: "uppercase", marginBottom: "24px", textAlign: "center",
              }}>What changes</div>

              <div className="comparison-grid" style={{
                display: "grid", gridTemplateColumns: "1fr 48px 1fr", gap: "0",
                alignItems: "stretch",
              }}>
                {/* Before */}
                <div className="comparison-panel" style={{
                  padding: "32px",
                  background: `rgba(var(--red-rgb),0.03)`,
                  border: `1px solid rgba(var(--red-rgb),0.1)`,
                  borderRadius: "16px 0 0 16px",
                }}>
                  <div style={{
                    fontSize: "28px", fontWeight: 900, color: `rgba(var(--red-rgb),0.2)`,
                    marginBottom: "20px", letterSpacing: "-1px",
                  }}>Before</div>
                  {[
                    "Agent guesses canister IDs",
                    "Hallucinated Motoko syntax",
                    "Outdated dfx commands",
                    "No idea about cycles or fees",
                    "Broken deploys, wasted time",
                    "Human has to fix everything",
                  ].map((text, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 0",
                      borderBottom: i < 5 ? `1px solid rgba(var(--red-rgb),0.06)` : "none",
                    }}>
                      <span style={{ color: `rgba(var(--red-rgb),0.4)`, fontSize: "14px" }}>{"\u25CC"}</span>
                      <span style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>{text}</span>
                    </div>
                  ))}
                </div>

                {/* Arrow */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-arrow)",
                }}>
                  <div style={{ fontSize: "24px", color: "var(--text-phantom)", transform: "scaleX(1.5)" }}>{"\u2192"}</div>
                </div>

                {/* After */}
                <div className="comparison-panel" style={{
                  padding: "32px",
                  background: `rgba(var(--accent-rgb),0.04)`,
                  border: `1px solid rgba(var(--accent-rgb),0.15)`,
                  borderRadius: "0 16px 16px 0",
                }}>
                  <div style={{
                    fontSize: "28px", fontWeight: 900,
                    background: "var(--gradient-accent)",
                    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                    marginBottom: "20px", letterSpacing: "-1px",
                  }}>After</div>
                  {[
                    "Exact canister IDs from skill",
                    "Tested, working code templates",
                    "Current dfx commands, verified",
                    "Fees and cycles handled correctly",
                    "Deploys work first try",
                    "Agent ships autonomously",
                  ].map((text, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 0",
                      borderBottom: i < 5 ? `1px solid rgba(var(--accent-rgb),0.08)` : "none",
                    }}>
                      <span style={{ color: "var(--accent)", fontSize: "10px" }}>{"\u25C6"}</span>
                      <span style={{ fontSize: "13px", color: "var(--text-secondary)", fontFamily: SANS_FONT }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Skill anatomy */}
            <div style={{ marginBottom: "72px" }}>
              <div style={{
                fontSize: "11px", color: "var(--text-faint)", letterSpacing: "3px",
                textTransform: "uppercase", marginBottom: "24px", textAlign: "center",
              }}>Anatomy of a skill</div>

              <div className="anatomy-table" style={{
                border: `1px solid rgba(var(--accent-rgb),0.15)`,
                borderRadius: "16px",
                overflow: "hidden",
              }}>
                {[
                  { section: "What this is", colorVar: "accent-text", rgbVar: "accent-text-rgb",
                    preview: "ckBTC is chain-key Bitcoin on the Internet Computer. This skill covers accepting deposits, sending transfers, checking balances, and minting.",
                    tag: "1 paragraph" },
                  { section: "Prerequisites", colorVar: "accent-blue", rgbVar: "blue-rgb",
                    preview: "dfx >= 0.24.0  \u00B7  Rust or Motoko  \u00B7  Requires: icrc-ledger, wallet",
                    tag: "exact versions" },
                  { section: "\u26A0 Common Agent Mistakes", colorVar: "yellow", rgbVar: "yellow-rgb",
                    preview: "DO NOT use pre-2025 minter canister ID (it changed)  \u00B7  DO NOT forget the 10 sat fee  \u00B7  DO NOT skip subaccounts for deposits",
                    tag: "guardrails" },
                  { section: "Step-by-step Instructions", colorVar: "green", rgbVar: "green-rgb",
                    preview: "1. Add dependencies \u2192 2. Import & configure \u2192 3. Implement deposit flow \u2192 4. Implement transfer \u2192 5. Deploy",
                    tag: "tested code" },
                  { section: "Verification", colorVar: "accent", rgbVar: "accent-rgb",
                    preview: "\u2713 dfx canister call ckbtc_ledger icrc1_balance_of \u2192 returns nat  \u00B7  \u2713 Transfer returns { Ok: nat }",
                    tag: "confirm it works" },
                ].map((item, i, arr) => (
                  <div key={i} className="anatomy-row" style={{
                    display: "grid", gridTemplateColumns: "200px 1fr 100px",
                    borderBottom: i < arr.length - 1 ? "1px solid var(--border-subtle)" : "none",
                    alignItems: "center",
                  }}>
                    <div style={{
                      padding: "20px 24px",
                      fontSize: "13px", fontWeight: 700, color: `var(--${item.colorVar})`,
                      borderRight: "1px solid var(--border-subtle)",
                    }}>{item.section}</div>
                    <div style={{
                      padding: "20px 24px",
                      fontSize: "12px", color: "var(--text-muted)",
                      fontFamily: SANS_FONT, lineHeight: 1.5,
                    }}>{item.preview}</div>
                    <div style={{ padding: "20px 16px", textAlign: "right" }}>
                      <span style={{
                        fontSize: "9px", padding: "3px 8px",
                        background: `rgba(var(--${item.rgbVar}),0.08)`,
                        border: `1px solid rgba(var(--${item.rgbVar}),0.2)`,
                        borderRadius: "4px", color: `var(--${item.colorVar})`,
                        textTransform: "uppercase", letterSpacing: "1px",
                      }}>{item.tag}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Terminal code example */}
            <div style={{ marginBottom: "72px" }}>
              <div style={{
                fontSize: "11px", color: "var(--text-faint)", letterSpacing: "3px",
                textTransform: "uppercase", marginBottom: "24px", textAlign: "center",
              }}>Any agent, any framework</div>

              <div style={{
                borderRadius: "16px", overflow: "hidden",
                border: `1px solid rgba(var(--blue-rgb),0.15)`,
              }}>
                <TerminalHeader title="agent.js" />
                <pre style={{
                  padding: "24px",
                  background: "var(--bg-code-deep)",
                  fontSize: "12px", lineHeight: 1.8,
                  color: "var(--text-tertiary)", overflow: "auto", margin: 0,
                  whiteSpace: "pre-wrap",
                }}>
<span>{`// 1. Agent decides it needs ckBTC integration\n`}</span>
<span style={{color:"var(--accent-blue)"}}>{`const skill = await fetch(\n  "https://skills.internetcomputer.org/api/v1/skills/ckbtc"\n);\n`}</span>
<span>{`\n// 2. Gets back structured instructions\n`}</span>
<span style={{color:"var(--accent-text)"}}>{`const { pitfalls, steps, code_templates, verification } =\n  await skill.json();\n`}</span>
<span>{`\n// 3. Pitfalls prevent hallucination\n`}</span>
<span style={{color:"var(--yellow)"}}>{`// Agent now knows:\n// - Correct canister ID: mxzaz-hqaaa-aaaar-qaada-cai\n// - Fee is 10 satoshis (not 0)\n// - Must use subaccounts for deposits\n`}</span>
<span>{`\n// 4. Agent executes with tested code\n`}</span>
<span style={{color:"var(--green)"}}>{`// \u2192 Deploys correctly on first try\n// \u2192 Runs verification checks\n// \u2192 Ships autonomously`}</span></pre>
              </div>

              {/* Framework logos grid */}
              <div className="frameworks-grid" style={{
                display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px",
                marginTop: "24px",
              }}>
                {FRAMEWORKS.map((fw) => {
                  const c = getFwColor(fw.name);
                  return (
                    <div key={fw.name} className="framework-card" style={{
                      padding: "16px",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-default)",
                      borderRadius: "10px",
                      display: "flex", alignItems: "center", gap: "12px",
                      transition: "all 0.2s",
                    }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "8px",
                        background: `${c}10`,
                        border: `1px solid ${c}25`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}>
                        <FrameworkIcon name={fw.name} color={c} />
                      </div>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>{fw.name}</div>
                        <div style={{ fontSize: "11px", color: "var(--text-ghost)" }}>{fw.note}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom CTA */}
            <div style={{
              textAlign: "center", padding: "48px 32px",
              background: "var(--gradient-cta)",
              borderRadius: "16px",
              border: `1px solid rgba(var(--accent-rgb),0.1)`,
            }}>
              <div style={{
                fontSize: "24px", fontWeight: 800, color: "var(--text-primary)",
                letterSpacing: "-1px", marginBottom: "12px",
              }}>The first chain agents can actually build on.</div>
              <p style={{
                fontSize: "14px", color: "var(--text-faint)", margin: "0 0 24px 0",
                fontFamily: SANS_FONT,
              }}>No other blockchain has this. Not Solana. Not Ethereum. Not anyone.</p>
              <code style={{
                display: "inline-block", padding: "12px 24px",
                background: "var(--bg-code)",
                border: `1px solid rgba(var(--accent-rgb),0.3)`,
                borderRadius: "8px", fontSize: "13px", color: "var(--accent-text)",
              }}>skills.internetcomputer.org/api/v1/skills</code>
            </div>
          </div>
        )}

        {/* API TAB */}
        {activeTab === "api" && (
          <div style={{ maxWidth: "860px" }}>
            <div style={{ marginBottom: "48px" }}>
              <p style={{
                fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700, color: "var(--text-primary)",
                letterSpacing: "-0.5px", lineHeight: 1.4, margin: "0 0 12px 0",
              }}>
                REST API. No auth. No keys.
              </p>
              <p style={{
                fontSize: "14px", color: "var(--text-faint)", margin: 0,
                fontFamily: SANS_FONT,
              }}>
                Base URL: <code style={{
                  color: "var(--accent-text)",
                  background: `rgba(var(--accent-rgb),0.1)`,
                  padding: "2px 8px", borderRadius: "3px",
                }}>https://skills.internetcomputer.org/api/v1</code>
              </p>
            </div>

            {/* Collapsible endpoints */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "48px" }}>
              {API_ENDPOINTS.map((endpoint, i) => (
                <div key={i} className="api-endpoint-card" style={{
                  border: "1px solid var(--border-default)",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}>
                  <div
                    onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                    style={{
                      padding: "14px 20px",
                      background: expandedEndpoint === i ? "var(--bg-input)" : "var(--bg-card-subtle)",
                      borderBottom: expandedEndpoint === i ? "1px solid var(--border-subtle)" : "none",
                      display: "flex", alignItems: "center", gap: "12px",
                      cursor: "pointer", transition: "background 0.15s",
                    }}
                  >
                    <span style={{
                      fontSize: "10px", fontWeight: 800, padding: "3px 10px",
                      background: endpoint.method === "POST" ? `rgba(var(--blue-rgb),0.15)` : `rgba(var(--green-rgb),0.15)`,
                      color: endpoint.method === "POST" ? "var(--accent-blue)" : "var(--green)",
                      borderRadius: "4px", letterSpacing: "1px",
                    }}>{endpoint.method}</span>
                    <code style={{ fontSize: "14px", color: "var(--text-sub)", fontWeight: 600 }}>{endpoint.path}</code>
                    <span className="endpoint-desc" style={{
                      fontSize: "12px", color: "var(--text-faint)", marginLeft: "auto",
                      fontFamily: SANS_FONT, marginRight: "8px",
                    }}>{endpoint.desc}</span>
                    <span style={{
                      fontSize: "16px", color: "var(--text-ghost)",
                      transform: expandedEndpoint === i ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s", lineHeight: 1,
                    }}>{"\u25BE"}</span>
                  </div>
                  {expandedEndpoint === i && (
                    <div style={{
                      padding: "16px 20px",
                      background: "var(--bg-response)",
                    }}>
                      <div style={{
                        fontSize: "10px", color: "var(--text-ghost)", textTransform: "uppercase",
                        letterSpacing: "1px", marginBottom: "8px",
                      }}>Response</div>
                      <pre style={{
                        fontSize: "11px", color: "var(--text-dim)", margin: 0,
                        whiteSpace: "pre-wrap", lineHeight: 1.6,
                      }}>{endpoint.response}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Quick start terminal */}
            <div style={{ marginBottom: "48px" }}>
              <div style={{
                fontSize: "11px", color: "var(--text-ghost)", letterSpacing: "2px",
                textTransform: "uppercase", marginBottom: "16px",
              }}>Quick start</div>

              <div style={{
                borderRadius: "10px", overflow: "hidden",
                border: `1px solid rgba(var(--accent-rgb),0.12)`,
              }}>
                <TerminalHeader title="terminal" />
                <pre style={{
                  padding: "20px",
                  background: "var(--bg-code-deep)",
                  fontSize: "12px", lineHeight: 1.8,
                  color: "var(--text-tertiary)", margin: 0,
                  whiteSpace: "pre-wrap",
                }}>
<span style={{color:"var(--text-faint)"}}># Get a skill as JSON</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{" skills.internetcomputer.org/api/v1/skills/ckbtc\n\n"}
<span style={{color:"var(--text-faint)"}}># Get raw markdown for agent context</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{" skills.internetcomputer.org/api/v1/skills/ckbtc/raw\n\n"}
<span style={{color:"var(--text-faint)"}}># Search for a skill</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{" skills.internetcomputer.org/api/v1/skills/search?q=token\n\n"}
<span style={{color:"var(--text-faint)"}}># Get multiple at once</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{' -X POST skills.internetcomputer.org/api/v1/skills/batch \\\n  -d \'{"ids":["ckbtc","icrc-ledger","wallet"]}\''}</pre>
              </div>
            </div>

            {/* Info cards */}
            <div className="api-info-grid" style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px",
            }}>
              {[
                { title: "No auth needed", desc: "Open API. No keys, no signup, no rate limits for normal use." },
                { title: "JSON + Markdown", desc: "Structured JSON for programmatic use. Raw markdown for context injection." },
                { title: "Always current", desc: "Skills update when dfx or canister IDs change. Versioned." },
              ].map((note) => (
                <div key={note.title} style={{
                  padding: "20px",
                  background: "var(--bg-card-subtle)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "8px",
                }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-soft)", marginBottom: "6px" }}>
                    {note.title}
                  </div>
                  <div style={{
                    fontSize: "12px", color: "var(--text-ghost)", lineHeight: 1.5,
                    fontFamily: SANS_FONT,
                  }}>{note.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10,
        borderTop: "1px solid var(--border-subtle)",
        padding: "24px 32px",
        marginTop: "80px",
      }}>
        <div className="footer-inner" style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "flex", justifyContent: "space-between",
          fontSize: "11px", color: "var(--text-phantom)",
        }}>
          <span>IC Skills {"\u2014"} The API for building on the Internet Computer</span>
          <span>Built for the agent era</span>
        </div>
      </footer>
    </div>
  );
}
