import { useState } from "preact/hooks";
import { API_ENDPOINTS, SANS_FONT } from "../data/constants";

function TerminalHeader({ title }: { title: string }) {
  return (
    <div style={{
      padding: "12px 20px",
      background: `rgba(var(--accent-rgb),0.04)`,
      borderBottom: `1px solid rgba(var(--accent-rgb),0.08)`,
      display: "flex", alignItems: "center", gap: "8px",
    }}>
      <div aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-red)" }} />
      <div aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-yellow)" }} />
      <div aria-hidden="true" style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--dot-green)" }} />
      <span style={{ marginLeft: "8px", fontSize: "11px", color: "var(--text-faint)" }}>{title}</span>
    </div>
  );
}

export default function ApiTab() {
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null);

  return (
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
          }}>https://dfinity.github.io/icskills/api/v1</code>
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
              role="button"
              tabIndex={0}
              aria-expanded={expandedEndpoint === i}
              onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedEndpoint(expandedEndpoint === i ? null : i); } }}
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
<span style={{color:"var(--accent-text)"}}>curl</span>{" dfinity.github.io/icskills/api/v1/skills/ckbtc\n\n"}
<span style={{color:"var(--text-faint)"}}># Get raw markdown for agent context</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{" dfinity.github.io/icskills/api/v1/skills/ckbtc/raw\n\n"}
<span style={{color:"var(--text-faint)"}}># Search for a skill</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{" dfinity.github.io/icskills/api/v1/skills/search?q=token\n\n"}
<span style={{color:"var(--text-faint)"}}># Get multiple at once</span>{"\n"}
<span style={{color:"var(--accent-text)"}}>curl</span>{' -X POST dfinity.github.io/icskills/api/v1/skills/batch \\\n  -d \'{"ids":["ckbtc","icrc-ledger","wallet"]}\''}</pre>
        </div>
      </div>

      {/* Info cards */}
      <div className="api-info-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px",
      }}>
        {[
          { title: "No auth needed", desc: "Open API. No keys, no signup, no rate limits for normal use." },
          { title: "JSON + Markdown", desc: "Structured JSON for programmatic use. Raw markdown for context injection." },
          { title: "Always current", desc: "Skills update when icp-cli or canister IDs change. Versioned." },
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
