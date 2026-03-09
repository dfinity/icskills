import { useState, useEffect } from "preact/hooks";
import { SANS_FONT } from "../data/constants";
import CopyButton from "./CopyButton";

const RAW_BASE = "https://raw.githubusercontent.com/dfinity/icskills/main/skills";

function getEndpoints(origin: string) {
  return [
    {
      label: "Skills discovery",
      url: `${origin}/.well-known/skills/index.json`,
      desc: "Discovery index listing all skills. Follows the Agent Skills Discovery RFC.",
      contentType: "application/json",
    },
    {
      label: "Single skill",
      url: `${origin}/.well-known/skills/ckbtc/SKILL.md`,
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
      url: `${origin}/llms.txt`,
      desc: "Short index with links to every skill. Follows the llms.txt convention.",
      contentType: "text/plain",
    },
    {
      label: "All skills (full)",
      url: `${origin}/llms-full.txt`,
      desc: "Every skill concatenated into one file. For full context injection.",
      contentType: "text/plain",
    },
  ];
}

export default function AccessTab() {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const endpoints = getEndpoints(origin);
  return (
    <div style={{ maxWidth: "860px" }}>
      <div style={{ marginBottom: "48px" }}>
        <h2 style={{
          fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800, color: "var(--text-primary)",
          letterSpacing: "-2px", lineHeight: 1.1, margin: "0 0 16px 0",
        }}>
          Get skills into<br />your agent.
        </h2>
        <p style={{
          fontSize: "15px", color: "var(--text-tertiary)", margin: 0, maxWidth: "560px",
          fontFamily: SANS_FONT, lineHeight: 1.6,
        }}>
          No auth. No keys. Every skill is a static file you can fetch directly.
        </p>
      </div>

      {/* Real endpoints */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "48px" }}>
        {endpoints.map((ep) => (
          <div key={ep.label} className="endpoint-card" style={{
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
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                  {ep.label}
                </div>
                <div className="endpoint-desc" style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>
                  {ep.desc}
                </div>
              </div>
              <span style={{
                fontSize: "9px", padding: "2px 8px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "3px", color: "var(--text-tertiary)",
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
                flex: 1, fontSize: "12px", color: "var(--text-secondary)",
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
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "6px" }}>
              {note.title}
            </div>
            <div style={{
              fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.5,
              fontFamily: SANS_FONT,
            }}>{note.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
