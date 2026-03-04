import { SANS_FONT } from "../data/constants";
import { SITE_URL } from "../data/site";
import CopyButton from "./CopyButton";

const RAW_BASE = "https://raw.githubusercontent.com/dfinity/icskills/main/skills";

const REAL_ENDPOINTS = [
  {
    label: "Skills discovery",
    url: `${SITE_URL}/.well-known/skills/index.json`,
    desc: "Discovery index listing all skills. Follows the Agent Skills Discovery RFC.",
    contentType: "application/json",
  },
  {
    label: "Single skill",
    url: `${SITE_URL}/.well-known/skills/ckbtc/SKILL.md`,
    desc: "Raw SKILL.md for one skill. Drop it straight into agent context.",
    contentType: "text/markdown",
  },
  {
    label: "Single skill (GitHub raw)",
    url: `${RAW_BASE}/ckbtc/SKILL.md`,
    desc: "Same content via GitHub raw URLs. Works without the site.",
    contentType: "text/plain",
  },
  {
    label: "Skill index",
    url: `${SITE_URL}/llms.txt`,
    desc: "Short index with links to every skill. Follows the llms.txt convention.",
    contentType: "text/plain",
  },
  {
    label: "All skills (full)",
    url: `${SITE_URL}/llms-full.txt`,
    desc: "Every skill concatenated into one file. For full context injection.",
    contentType: "text/plain",
  },
];

export default function AccessTab() {
  return (
    <div style={{ maxWidth: "860px" }}>
      <div style={{ marginBottom: "48px" }}>
        <p style={{
          fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700, color: "var(--text-primary)",
          letterSpacing: "-0.5px", lineHeight: 1.4, margin: "0 0 12px 0",
        }}>
          Get skills into your agent.
        </p>
        <p style={{
          fontSize: "14px", color: "var(--text-faint)", margin: 0,
          fontFamily: SANS_FONT,
        }}>
          No auth. No keys. Every skill is a static file you can fetch directly.
        </p>
      </div>

      {/* Real endpoints */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "48px" }}>
        {REAL_ENDPOINTS.map((ep) => (
          <div key={ep.label} style={{
            border: "1px solid var(--border-default)",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "14px 20px",
              background: "var(--bg-card-subtle)",
              display: "flex", alignItems: "center", gap: "12px",
              flexWrap: "wrap",
            }}>
              <span style={{
                fontSize: "10px", fontWeight: 800, padding: "3px 10px",
                background: `rgba(var(--green-rgb),0.15)`,
                color: "var(--green)",
                borderRadius: "4px", letterSpacing: "1px",
              }}>GET</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {ep.label}
                </div>
                <div style={{ fontSize: "11px", color: "var(--text-faint)", fontFamily: SANS_FONT }}>
                  {ep.desc}
                </div>
              </div>
              <span style={{
                fontSize: "9px", padding: "2px 8px",
                background: `rgba(var(--accent-rgb),0.08)`,
                border: `1px solid rgba(var(--accent-rgb),0.15)`,
                borderRadius: "3px", color: "var(--accent-text)",
                textTransform: "uppercase", letterSpacing: "1px",
                whiteSpace: "nowrap",
              }}>{ep.contentType}</span>
            </div>
            <div style={{
              padding: "10px 20px",
              background: "var(--bg-code)",
              display: "flex", alignItems: "center", gap: "8px",
            }}>
              <code style={{
                flex: 1, fontSize: "11px", color: "var(--accent)",
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                minWidth: 0,
              }}>{ep.url}</code>
              <CopyButton text={ep.url} />
            </div>
          </div>
        ))}
      </div>

      {/* Info cards */}
      <div className="access-info-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px",
      }}>
        {[
          { title: "No auth needed", desc: "Open access. No keys, no signup. Every URL returns content directly." },
          { title: "Plain markdown", desc: "Skills are markdown files. Paste into any agent context, rules file, or system prompt." },
          { title: "Always current", desc: "Skills update when canister IDs or APIs change. Git-tracked with last-updated dates." },
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
  );
}
