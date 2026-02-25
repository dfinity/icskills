import { useState } from "preact/hooks";

const SKILLS = [
  {
    id: "ckbtc",
    name: "ckBTC Integration",
    category: "DeFi",
    difficulty: "Advanced",
    description: "Accept, send, and manage ckBTC in your canister. Covers minting, transfers, balance checks, and UTXO management.",
    endpoints: 14,
    lastUpdated: "2026-02-20",
    version: "2.1.0",
    status: "stable",
    dependencies: ["icrc-ledger", "wallet"],
  },
  {
    id: "multi-canister",
    name: "Multi-Canister Architecture",
    category: "Architecture",
    difficulty: "Advanced",
    description: "Design and deploy multi-canister dapps with inter-canister calls, shared state patterns, and upgrade strategies.",
    endpoints: 8,
    lastUpdated: "2026-02-18",
    version: "3.0.1",
    status: "stable",
    dependencies: ["stable-memory"],
  },
  {
    id: "internet-identity",
    name: "Internet Identity Auth",
    category: "Auth",
    difficulty: "Intermediate",
    description: "Integrate Internet Identity authentication into frontend and backend canisters. Delegation, session management, and anchor handling.",
    endpoints: 6,
    lastUpdated: "2026-02-22",
    version: "4.0.0",
    status: "stable",
    dependencies: ["asset-canister"],
  },
  {
    id: "icrc-ledger",
    name: "ICRC Ledger Standard",
    category: "Tokens",
    difficulty: "Intermediate",
    description: "Deploy and interact with ICRC-1/ICRC-2 token ledgers. Minting, approvals, transfers, and metadata.",
    endpoints: 11,
    lastUpdated: "2026-02-19",
    version: "2.3.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "https-outcalls",
    name: "HTTPS Outcalls",
    category: "Integration",
    difficulty: "Intermediate",
    description: "Make HTTP requests from canisters to external APIs. Consensus-safe request patterns, transform functions, and cost management.",
    endpoints: 4,
    lastUpdated: "2026-02-15",
    version: "1.5.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "sns-launch",
    name: "SNS DAO Launch",
    category: "Governance",
    difficulty: "Expert",
    description: "Configure and launch an SNS DAO. Token economics, proposal types, nervous system parameters, and decentralization swap.",
    endpoints: 22,
    lastUpdated: "2026-02-21",
    version: "1.8.0",
    status: "stable",
    dependencies: ["icrc-ledger", "multi-canister"],
  },
  {
    id: "asset-canister",
    name: "Asset Canister & Frontend",
    category: "Frontend",
    difficulty: "Beginner",
    description: "Deploy frontend assets on-chain. Certified assets, custom domains, SPA routing, and content encoding.",
    endpoints: 5,
    lastUpdated: "2026-02-17",
    version: "3.2.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "stable-memory",
    name: "Stable Memory & Upgrades",
    category: "Architecture",
    difficulty: "Advanced",
    description: "Manage canister state across upgrades. Stable structures, pre/post upgrade hooks, and memory-mapped data.",
    endpoints: 6,
    lastUpdated: "2026-02-16",
    version: "2.0.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "wallet",
    name: "Cycles Wallet Management",
    category: "Infrastructure",
    difficulty: "Beginner",
    description: "Create, fund, and manage cycles wallets. Top-up canisters, check balances, and automate cycle management.",
    endpoints: 7,
    lastUpdated: "2026-02-14",
    version: "1.4.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "vetkd",
    name: "vetKD Encryption",
    category: "Security",
    difficulty: "Expert",
    description: "Implement on-chain encryption using vetKD. Key derivation, encryption/decryption flows, and access control patterns.",
    endpoints: 5,
    lastUpdated: "2026-02-10",
    version: "0.9.0",
    status: "beta",
    dependencies: ["internet-identity"],
  },
  {
    id: "certified-variables",
    name: "Certified Variables",
    category: "Security",
    difficulty: "Advanced",
    description: "Serve verified responses from query calls. Merkle tree construction, certificate validation, and certified asset patterns.",
    endpoints: 4,
    lastUpdated: "2026-02-12",
    version: "1.2.0",
    status: "stable",
    dependencies: [],
  },
  {
    id: "evm-rpc",
    name: "EVM RPC Integration",
    category: "Integration",
    difficulty: "Advanced",
    description: "Call Ethereum and EVM chains from IC canisters. JSON-RPC, transaction signing, and cross-chain workflows.",
    endpoints: 9,
    lastUpdated: "2026-02-20",
    version: "1.1.0",
    status: "stable",
    dependencies: ["https-outcalls"],
  },
];

const CATEGORIES = ["All", "Architecture", "Auth", "DeFi", "Frontend", "Governance", "Infrastructure", "Integration", "Security", "Tokens"];

const SKILL_PREVIEW = `# ckBTC Integration
## SKILL.md v2.1.0

> This skill enables an AI agent to integrate ckBTC
> into any Internet Computer canister.

## Prerequisites
- dfx >= 0.24.0
- Rust canister OR Motoko canister
- Requires: icrc-ledger skill, wallet skill

## What This Does
ckBTC is chain-key Bitcoin on the Internet Computer.
This skill covers:
1. Accepting ckBTC deposits
2. Sending ckBTC transfers
3. Checking balances
4. Managing UTXOs
5. Minting ckBTC from BTC

## Common Agent Mistakes
- DO NOT use the ckBTC minter canister ID from
  pre-2025 docs (it changed)
- DO NOT forget to set the fee (10 satoshis)
- DO NOT skip the subaccount for user deposits
- The ledger canister ID on mainnet is:
  mxzaz-hqaaa-aaaar-qaada-cai

## Step 1: Add Dependencies

### Motoko (mops.toml)
\`\`\`toml
[dependencies]
icrc1 = "https://github.com/dfinity/..."
\`\`\`

### Rust (Cargo.toml)
\`\`\`toml
[dependencies]
icrc-ledger-types = "0.1"
candid = "0.10"
\`\`\`

## Step 2: Import and Configure
...

## Verification
After completing this skill, verify:
- dfx canister call ckbtc_ledger icrc1_balance_of
- Transfer returns { Ok: nat }
- Subaccounts generate unique deposit addrs`;

const AGENT_EXAMPLE = `// Any AI agent reads the skill endpoint:

const skill = await fetch(
  "https://skills.internetcomputer.org/api/v1/skills/ckbtc"
);

const {
  instructions,
  code_templates,
  pitfalls,
  verification
} = await skill.json();

// Agent now knows EXACTLY how to:
// - Which canister IDs to use (no hallucination)
// - What the correct API calls are
// - What mistakes to avoid
// - How to verify it worked

// Works with ANY agent framework:
// Claude, GPT, Copilot, Devin, Cursor...`;

const SANS_FONT = "'Inter', system-ui, sans-serif";

const SECTION_LABEL = {
  fontSize: "11px",
  letterSpacing: "2px",
  textTransform: "uppercase",
};

const DIFFICULTY_COLORS = {
  Beginner: "#34d399",
  Intermediate: "#60a5fa",
  Advanced: "#fbbf24",
  Expert: "#f87171",
};

const TAB_LABELS = {
  "browse": "Browse",
  "how-it-works": "How It Works",
  "api": "API",
};

const TOTAL_ENDPOINTS = SKILLS.reduce((sum, s) => sum + s.endpoints, 0);

function CategoryIcon({ category, size = 18 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 18 18",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    xmlns: "http://www.w3.org/2000/svg",
  };

  switch (category) {
    case "Architecture":
      return (
        <svg {...common}>
          <path d="M9 2L2 6l7 4 7-4z" />
          <path d="M2 9l7 4 7-4" />
          <path d="M2 12l7 4 7-4" />
        </svg>
      );
    case "Auth":
      return (
        <svg {...common}>
          <path d="M6 8V5.5a3 3 0 016 0V8" />
          <path d="M4 8h10a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" />
        </svg>
      );
    case "DeFi":
      return (
        <svg {...common}>
          <path d="M2 14l4-5 3 2.5L16 4" />
          <path d="M12 4h4v4" />
        </svg>
      );
    case "Frontend":
      return (
        <svg {...common}>
          <path d="M2.5 4h13a1 1 0 011 1v9a1 1 0 01-1 1h-13a1 1 0 01-1-1V5a1 1 0 011-1z" />
          <path d="M1.5 7h15" />
        </svg>
      );
    case "Governance":
      return (
        <svg {...common}>
          <path d="M2 15h14" />
          <path d="M4 15V8" />
          <path d="M9 15V8" />
          <path d="M14 15V8" />
          <path d="M2 8l7-5.5 7 5.5" />
        </svg>
      );
    case "Infrastructure":
      return (
        <svg {...common}>
          <circle cx="9" cy="9" r="2.5" />
          <path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M3.8 14.2l1.4-1.4M12.8 5.2l1.4-1.4" />
        </svg>
      );
    case "Integration":
      return (
        <svg {...common}>
          <path d="M7 11L5 13a2.8 2.8 0 01-4-4l2-2" />
          <path d="M11 7l2-2a2.8 2.8 0 014 4l-2 2" />
          <path d="M7 11l4-4" />
        </svg>
      );
    case "Security":
      return (
        <svg {...common}>
          <path d="M9 1.5L3 4.5v4c0 4 2.5 7 6 8.5 3.5-1.5 6-4.5 6-8.5v-4z" />
        </svg>
      );
    case "Tokens":
      return (
        <svg {...common}>
          <path d="M9 2a7 7 0 100 14A7 7 0 009 2z" />
          <path d="M9 5v8" />
          <path d="M7 7.5h4" />
          <path d="M7 10.5h4" />
        </svg>
      );
    default:
      return null;
  }
}

export function App() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSkill, setSelectedSkill] = useState(null);
  const [activeTab, setActiveTab] = useState("browse");

  const query = searchQuery.toLowerCase();
  const filtered = SKILLS.filter((s) => {
    const matchCat = activeCategory === "All" || s.category === activeCategory;
    const matchSearch = s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query);
    return matchCat && matchSearch;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0a0a0f",
      color: "#e2e2e8",
      fontFamily: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Grid background */}
      <div style={{
        position: "fixed", inset: 0, opacity: 0.04,
        backgroundImage: `
          linear-gradient(rgba(139,92,246,0.5) 1px, transparent 1px),
          linear-gradient(90deg, rgba(139,92,246,0.5) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
        pointerEvents: "none",
      }} />

      {/* Glow orbs */}
      <div style={{
        position: "fixed", top: "-200px", right: "-200px",
        width: "600px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(99,52,199,0.15) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "fixed", bottom: "-300px", left: "-100px",
        width: "500px", height: "500px", borderRadius: "50%",
        background: "radial-gradient(circle, rgba(45,134,204,0.1) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Header */}
      <header style={{
        position: "relative", zIndex: 10,
        borderBottom: "1px solid rgba(139,92,246,0.15)",
        padding: "0 32px",
      }}>
        <div style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          height: "64px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.5px", color: "#fff" }}>
              IC Skills
            </span>
            <span style={{
              fontSize: "10px", padding: "2px 8px",
              background: "rgba(139,92,246,0.2)",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: "99px", color: "#a78bfa",
              letterSpacing: "1px", textTransform: "uppercase",
            }}>Agent-First</span>
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            {["browse", "how-it-works", "api"].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                padding: "6px 16px", fontSize: "12px",
                background: activeTab === tab ? "rgba(139,92,246,0.15)" : "transparent",
                border: activeTab === tab ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                borderRadius: "6px",
                color: activeTab === tab ? "#a78bfa" : "#666",
                cursor: "pointer", transition: "all 0.2s",
              }}>
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main style={{ position: "relative", zIndex: 10, maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>

        {activeTab === "browse" && (
          <>
            {/* Hero */}
            <div style={{ marginBottom: "48px" }}>
              <div style={{
                fontSize: "11px", color: "#8b5cf6", letterSpacing: "3px",
                textTransform: "uppercase", marginBottom: "16px",
                display: "flex", alignItems: "center", gap: "8px",
              }}>
                <span style={{ display: "inline-block", width: "24px", height: "1px", background: "#8b5cf6" }} />
                Internet Computer Protocol
              </div>
              <h1 style={{
                fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800,
                lineHeight: 1.1, margin: "0 0 16px 0",
                letterSpacing: "-2px",
                background: "linear-gradient(135deg, #fff 0%, #a78bfa 50%, #60a5fa 100%)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>
                Skills for agents,<br />not docs for humans.
              </h1>
              <p style={{
                fontSize: "15px", color: "#888", maxWidth: "560px",
                lineHeight: 1.6, margin: 0, fontFamily: SANS_FONT,
              }}>
                Structured, versioned, agent-readable skill files for every Internet Computer capability.
                Your AI reads the skill. It builds correctly. No hallucinations.
              </p>

              {/* Stats */}
              <div className="hero-stats" style={{
                display: "flex", gap: "32px", marginTop: "32px",
              }}>
                {[
                  { val: TOTAL_ENDPOINTS, label: "API Endpoints" },
                  { val: SKILLS.length, label: "Skills" },
                  { val: "0", label: "Hallucinations" },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: "28px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>{val}</div>
                    <div style={{ ...SECTION_LABEL, color: "#555" }}>{label}</div>
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
                  color: "#555", fontSize: "14px",
                }}>{"\u2315"}</span>
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onInput={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%", padding: "12px 16px 12px 38px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: "8px", color: "#e2e2e8",
                    fontSize: "13px", outline: "none",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div className="endpoint-hint" style={{
                padding: "10px 16px",
                background: "rgba(139,92,246,0.1)",
                border: "1px solid rgba(139,92,246,0.2)",
                borderRadius: "8px", fontSize: "12px", color: "#a78bfa",
                whiteSpace: "nowrap",
              }}>
                fetch("skills.internetcomputer.org/api/v1/skills/{"{"}
                <span style={{ color: "#60a5fa" }}>id</span>
                {"}"}")
              </div>
            </div>

            {/* Category filters */}
            <div style={{
              display: "flex", gap: "6px", marginBottom: "32px",
              flexWrap: "wrap",
            }}>
              {CATEGORIES.map((cat) => (
                <button key={cat} className="category-pill" onClick={() => setActiveCategory(cat)} style={{
                  padding: "6px 14px", fontSize: "11px",
                  background: activeCategory === cat ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.02)",
                  border: `1px solid ${activeCategory === cat ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: "6px",
                  color: activeCategory === cat ? "#a78bfa" : "#666",
                  cursor: "pointer",
                  letterSpacing: "0.5px",
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
              {filtered.map((skill) => {
                const dc = DIFFICULTY_COLORS[skill.difficulty];
                return (
                  <div
                    key={skill.id}
                    className="skill-card"
                    onClick={() => setSelectedSkill(selectedSkill === skill.id ? null : skill.id)}
                    style={{
                      padding: "24px",
                      background: selectedSkill === skill.id
                        ? "rgba(139,92,246,0.06)"
                        : "rgba(255,255,255,0.02)",
                      border: `1px solid ${selectedSkill === skill.id ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: "12px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <span style={{
                          fontSize: "18px", width: "36px", height: "36px",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(139,92,246,0.08)",
                          borderRadius: "8px",
                          color: "#a78bfa",
                        }}><CategoryIcon category={skill.category} /></span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>
                            {skill.name}
                          </div>
                          <div style={{ fontSize: "11px", color: "#555" }}>
                            v{skill.version} \u00B7 {skill.category}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontSize: "9px",
                        display: "flex", alignItems: "center", gap: "5px",
                      }}>
                        <span style={{
                          display: "inline-block",
                          width: "4px", height: "4px",
                          borderRadius: "50%",
                          background: dc,
                        }} />
                        <span style={{ color: "#555" }}>{skill.difficulty}</span>
                      </span>
                    </div>

                    <p style={{
                      fontSize: "12px", color: "#777", lineHeight: 1.6,
                      margin: "0 0 16px 0",
                      fontFamily: SANS_FONT,
                    }}>{skill.description}</p>

                    <div style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                    }}>
                      <div style={{ fontSize: "11px", color: "#444" }}>
                        {skill.endpoints} operations \u00B7 updated {skill.lastUpdated}
                      </div>
                      {skill.status === "beta" && (
                        <span style={{
                          fontSize: "9px", padding: "2px 6px",
                          background: "rgba(251,191,36,0.1)",
                          border: "1px solid rgba(251,191,36,0.2)",
                          color: "#fbbf24", borderRadius: "3px",
                          textTransform: "uppercase", letterSpacing: "1px",
                        }}>beta</span>
                      )}
                    </div>

                    {skill.dependencies.length > 0 && (
                      <div style={{
                        marginTop: "12px", paddingTop: "12px",
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        display: "flex", gap: "6px", flexWrap: "wrap",
                      }}>
                        <span style={{ fontSize: "10px", color: "#444" }}>requires:</span>
                        {skill.dependencies.map((dep) => (
                          <span key={dep} style={{
                            fontSize: "10px", padding: "2px 8px",
                            background: "rgba(96,165,250,0.08)",
                            border: "1px solid rgba(96,165,250,0.15)",
                            borderRadius: "3px", color: "#60a5fa",
                          }}>{dep}</span>
                        ))}
                      </div>
                    )}

                    {selectedSkill === skill.id && (
                      <div style={{
                        marginTop: "16px", paddingTop: "16px",
                        borderTop: "1px solid rgba(139,92,246,0.15)",
                      }}>
                        <div style={{
                          fontSize: "11px", color: "#a78bfa",
                          fontFamily: "inherit", marginBottom: "8px",
                        }}>Agent Endpoint:</div>
                        <code style={{
                          display: "block", padding: "12px 16px",
                          background: "rgba(0,0,0,0.4)",
                          border: "1px solid rgba(139,92,246,0.15)",
                          borderRadius: "6px", fontSize: "11px", color: "#8b5cf6",
                          wordBreak: "break-all",
                        }}>
                          GET https://skills.internetcomputer.org/api/v1/skills/{skill.id}
                        </code>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === "how-it-works" && (
          <div style={{ maxWidth: "900px" }}>
            {/* Hero statement */}
            <div style={{ marginBottom: "64px", textAlign: "center" }}>
              <h2 style={{
                fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 800, color: "#fff",
                letterSpacing: "-2px", margin: "0 0 16px 0", lineHeight: 1.1,
              }}>Agents don't read docs.<br />
                <span style={{ background: "linear-gradient(135deg, #a78bfa, #60a5fa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  They read skills.
                </span>
              </h2>
              <p style={{
                fontSize: "15px", color: "#666", lineHeight: 1.7, maxWidth: "520px", margin: "0 auto",
                fontFamily: SANS_FONT,
              }}>
                Documentation explains concepts so humans understand them.
                A skill file gives an agent everything it needs to do the thing correctly on the first try.
              </p>
            </div>

            {/* 3-step flow */}
            <div className="step-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px", marginBottom: "64px" }}>
              {[
                { step: "01", title: "Agent fetches skill", desc: "One API call. Raw markdown. Straight into context.", color: "#8b5cf6" },
                { step: "02", title: "Reads instructions", desc: "Correct canister IDs, working code, known pitfalls.", color: "#60a5fa" },
                { step: "03", title: "Builds correctly", desc: "Deploys, verifies, ships. No hallucinations.", color: "#34d399" },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="step-card" style={{
                  padding: "28px 24px",
                  background: "rgba(255,255,255,0.02)",
                  borderTop: `2px solid ${color}`,
                }}>
                  <div style={{ fontSize: "32px", fontWeight: 800, color, opacity: 0.3, marginBottom: "12px", letterSpacing: "-1px" }}>{step}</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#fff", marginBottom: "8px" }}>{title}</div>
                  <div style={{ fontSize: "12px", color: "#555", lineHeight: 1.6, fontFamily: SANS_FONT }}>{desc}</div>
                </div>
              ))}
            </div>

            {/* Before / After comparison */}
            <div style={{
              ...SECTION_LABEL, color: "#555", marginBottom: "20px",
            }}>Why skills beat documentation</div>
            <div className="comparison-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1px", marginBottom: "64px", background: "rgba(255,255,255,0.04)", borderRadius: "12px", overflow: "hidden" }}>
              {[
                {
                  title: "Traditional Docs", color: "#f87171", textColor: "#444", icon: "\u2715",
                  items: ["Written for humans to browse", "Scattered across pages", "Examples may be outdated", "Agents hallucinate missing context", "No verification steps", "Unstructured prose"],
                },
                {
                  title: "IC Skills", color: "#34d399", textColor: "#555", icon: "\u2713",
                  items: ["Written for agents to execute", "One skill = one capability", "Versioned & tested code", "Pitfalls section prevents errors", "Built-in verification checks", "Structured SKILL.md format"],
                },
              ].map(({ title, color, textColor, icon, items }) => (
                <div key={title} className="comparison-panel" style={{ padding: "28px", background: "#0a0a0f" }}>
                  <div style={{
                    fontSize: "11px", color, fontWeight: 700, marginBottom: "20px",
                    letterSpacing: "1px", textTransform: "uppercase",
                    display: "flex", alignItems: "center", gap: "8px",
                  }}>
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: color }} />
                    {title}
                  </div>
                  {items.map((item) => (
                    <div key={item} style={{
                      fontSize: "13px", color: textColor, lineHeight: 1.5, padding: "6px 0",
                      fontFamily: SANS_FONT,
                      display: "flex", alignItems: "center", gap: "10px",
                    }}>
                      <span style={{ color, fontSize: "10px", flexShrink: 0 }}>{icon}</span>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Anatomy of a skill */}
            <div style={{ marginBottom: "64px" }}>
              <div style={{
                ...SECTION_LABEL, color: "#8b5cf6", marginBottom: "8px",
              }}>Anatomy of a Skill File</div>
              <p style={{
                fontSize: "13px", color: "#555", marginBottom: "20px",
                fontFamily: SANS_FONT,
              }}>Every skill follows the same structure. An agent reads it once, executes correctly.</p>

              <div style={{ position: "relative" }}>
                {/* Line connector */}
                <div style={{
                  position: "absolute", left: "15px", top: "20px", bottom: "20px",
                  width: "1px", background: "rgba(139,92,246,0.15)",
                }} />

                {[
                  { label: "Header", desc: "Name, version, dependencies, difficulty", color: "#8b5cf6" },
                  { label: "Canister IDs", desc: "Exact mainnet IDs \u2014 the #1 thing agents hallucinate", color: "#f87171" },
                  { label: "Mistakes", desc: "Numbered list of specific things that break your build", color: "#fbbf24" },
                  { label: "Motoko + Rust", desc: "Complete, tested, copy-paste-ready implementations", color: "#60a5fa" },
                  { label: "Verification", desc: "Exact commands + expected output to confirm it worked", color: "#34d399" },
                ].map(({ label, desc, color }) => (
                  <div key={label} style={{
                    display: "flex", alignItems: "flex-start", gap: "16px",
                    padding: "12px 0", position: "relative",
                  }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "50%",
                      background: `${color}15`, border: `1px solid ${color}30`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, zIndex: 1,
                    }}>
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "#fff", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "12px", color: "#555", fontFamily: SANS_FONT }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live skill preview */}
            <div style={{ marginBottom: "64px" }}>
              <div style={{
                ...SECTION_LABEL, color: "#8b5cf6", marginBottom: "8px",
              }}>Example: ckBTC Skill File</div>
              <p style={{
                fontSize: "13px", color: "#555", marginBottom: "16px",
                fontFamily: SANS_FONT,
              }}>This is what an agent actually reads. Raw markdown, straight into context.</p>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  fontSize: "10px", padding: "3px 10px",
                  background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)",
                  borderRadius: "4px", color: "#a78bfa", letterSpacing: "0.5px",
                  zIndex: 1,
                }}>SKILL.md</div>
                <pre style={{
                  padding: "24px",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(139,92,246,0.1)",
                  borderRadius: "12px",
                  fontSize: "11.5px",
                  lineHeight: 1.7,
                  color: "#888",
                  overflow: "auto",
                  maxHeight: "480px",
                  whiteSpace: "pre-wrap",
                }}>{SKILL_PREVIEW}</pre>
              </div>
            </div>

            {/* Agent integration code */}
            <div style={{ marginBottom: "48px" }}>
              <div style={{
                ...SECTION_LABEL, color: "#60a5fa", marginBottom: "8px",
              }}>Works With Any Agent</div>
              <p style={{
                fontSize: "13px", color: "#555", marginBottom: "16px",
                fontFamily: SANS_FONT,
              }}>Claude, GPT, Copilot, Devin, Cursor, or anything built next year. One fetch call.</p>
              <div style={{ position: "relative" }}>
                <div style={{
                  position: "absolute", top: "12px", right: "12px",
                  fontSize: "10px", padding: "3px 10px",
                  background: "rgba(96,165,250,0.15)", border: "1px solid rgba(96,165,250,0.25)",
                  borderRadius: "4px", color: "#60a5fa", letterSpacing: "0.5px",
                  zIndex: 1,
                }}>agent.js</div>
                <pre style={{
                  padding: "24px",
                  background: "rgba(0,0,0,0.5)",
                  border: "1px solid rgba(96,165,250,0.1)",
                  borderRadius: "12px",
                  fontSize: "11.5px",
                  lineHeight: 1.7,
                  color: "#60a5fa",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                }}>{AGENT_EXAMPLE}</pre>
              </div>
            </div>

            {/* Bottom CTA stats */}
            <div style={{
              padding: "32px",
              background: "rgba(139,92,246,0.04)",
              border: "1px solid rgba(139,92,246,0.12)",
              borderRadius: "12px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: "13px", color: "#777", marginBottom: "20px", fontFamily: SANS_FONT }}>
                The first blockchain to become truly agent-buildable wins the next wave of development.
              </div>
              <div className="cta-stats" style={{ display: "flex", justifyContent: "center", gap: "48px" }}>
                {[
                  { val: "12", label: "IC capabilities covered" },
                  { val: "2", label: "Languages (Motoko + Rust)" },
                  { val: "0", label: "Agent hallucinations" },
                ].map(({ val, label }) => (
                  <div key={label}>
                    <div style={{ fontSize: "24px", fontWeight: 800, color: "#fff", letterSpacing: "-1px" }}>{val}</div>
                    <div style={{ fontSize: "10px", color: "#444", textTransform: "uppercase", letterSpacing: "1.5px" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "api" && (
          <div style={{ maxWidth: "800px" }}>
            <h2 style={{
              fontSize: "32px", fontWeight: 800, color: "#fff",
              letterSpacing: "-1.5px", margin: "0 0 12px 0",
            }}>Agent API</h2>
            <p style={{
              fontSize: "15px", color: "#777", lineHeight: 1.7,
              margin: "0 0 40px 0", fontFamily: SANS_FONT,
            }}>
              Every skill is served from on-chain canisters. Agents fetch skills via a simple REST API or directly from the canister.
            </p>

            {[
              {
                method: "GET",
                path: "/api/v1/skills",
                desc: "List all available skills with metadata",
                response: `{ "skills": [{ "id": "ckbtc", "name": "ckBTC Integration", "version": "2.1.0", ... }] }`
              },
              {
                method: "GET",
                path: "/api/v1/skills/{id}",
                desc: "Get full skill file with instructions, code, and pitfalls",
                response: `{ "id": "ckbtc", "instructions": "...", "code_templates": {...}, "pitfalls": [...], "verification": [...] }`
              },
              {
                method: "GET",
                path: "/api/v1/skills/{id}/raw",
                desc: "Get raw SKILL.md markdown \u2014 drop straight into agent context",
                response: `# ckBTC Integration\n## SKILL.md v2.1.0\n...`
              },
              {
                method: "GET",
                path: "/api/v1/skills/{id}/dependencies",
                desc: "Resolve full dependency tree for a skill",
                response: `{ "skill": "ckbtc", "requires": ["icrc-ledger", "wallet"], "resolved": [...] }`
              },
            ].map((endpoint) => (
              <div key={endpoint.path} className="api-endpoint-card" style={{
                marginBottom: "24px", padding: "24px",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "12px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{
                    fontSize: "10px", fontWeight: 800, padding: "3px 8px",
                    background: "rgba(52,211,153,0.15)",
                    color: "#34d399",
                    borderRadius: "4px", letterSpacing: "1px",
                  }}>{endpoint.method}</span>
                  <code style={{ fontSize: "13px", color: "#a78bfa" }}>{endpoint.path}</code>
                </div>
                <p style={{
                  fontSize: "13px", color: "#666", margin: "8px 0 12px 0",
                  fontFamily: SANS_FONT,
                }}>{endpoint.desc}</p>
                <pre style={{
                  padding: "12px 16px",
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: "6px",
                  fontSize: "11px", color: "#555",
                  overflow: "auto",
                  whiteSpace: "pre-wrap",
                  margin: 0,
                }}>{endpoint.response}</pre>
              </div>
            ))}

            <div style={{
              marginTop: "40px", padding: "24px",
              background: "rgba(139,92,246,0.05)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: "12px",
            }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#a78bfa", marginBottom: "8px" }}>
                Canister Direct Access
              </div>
              <p style={{
                fontSize: "13px", color: "#666", margin: "0 0 12px 0",
                fontFamily: SANS_FONT,
              }}>
                Agents can also call the skills canister directly via Candid:
              </p>
              <pre style={{
                padding: "12px 16px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "6px",
                fontSize: "11px", color: "#8b5cf6",
                overflow: "auto", margin: 0,
                whiteSpace: "pre-wrap",
              }}>{`dfx canister call skills_registry get_skill '("ckbtc")'
dfx canister call skills_registry list_skills '()'
dfx canister call skills_registry resolve_deps '("sns-launch")'`}</pre>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        position: "relative", zIndex: 10,
        borderTop: "1px solid rgba(255,255,255,0.04)",
        padding: "24px 32px",
        marginTop: "80px",
      }}>
        <div className="footer-inner" style={{
          maxWidth: "1200px", margin: "0 auto",
          display: "flex", justifyContent: "space-between",
          fontSize: "11px", color: "#333",
        }}>
          <span>IC Skills \u2014 100% hosted on the Internet Computer</span>
          <span>Built for the agent era</span>
        </div>
      </footer>
    </div>
  );
}
