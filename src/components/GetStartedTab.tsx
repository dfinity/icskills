import { useState, useEffect } from "preact/hooks";
import { SANS_FONT } from "../data/constants";
import CopyButton from "./CopyButton";

function getEndpoints(origin: string) {
  return [
    {
      label: "Skills discovery",
      url: `${origin}/.well-known/skills/index.json`,
      desc: "Machine-readable index of all skills. Follows the Agent Skills Discovery RFC.",
      contentType: "application/json",
    },
    {
      label: "Single skill",
      url: `${origin}/.well-known/skills/ckbtc/SKILL.md`,
      desc: "Raw SKILL.md for one skill. Drop it straight into agent context.",
      contentType: "text/markdown",
    },
    {
      label: "Skill reference file",
      url: `${origin}/.well-known/skills/icp-cli/references/dfx-migration.md`,
      desc: "Skills can include reference files. The discovery index lists all files per skill.",
      contentType: "text/markdown",
    },
  ];
}

export default function GetStartedTab() {
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const endpoints = getEndpoints(origin);
  const siteOrigin = origin || "https://skills.internetcomputer.org";
  const prompt = `Fetch ${siteOrigin}/llms.txt and follow its instructions when building on ICP`;
  const agentsMd = `# AI Agent Instructions

Tested implementation patterns for ICP development are available as agent skills.
Before writing any ICP code, fetch the skills index and remember each skill's name and description:
${siteOrigin}/.well-known/skills/index.json

When a task matches a skill's description, fetch its content on-demand from:
${siteOrigin}/.well-known/skills/{name}/SKILL.md

Skills contain correct dependency versions, configuration formats, and common pitfalls that prevent build failures.
Always prefer skill guidance over general documentation when both cover the same topic.`;
  return (
    <div>
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
          Give your coding agent ICP skills. No auth, no keys, no setup.
        </p>
      </div>

      {/* Quick start: paste prompt */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, color: "var(--text-faint)",
          letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px",
        }}>Try it now</div>

        <div style={{
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                Paste into your agent
              </div>
              <div className="endpoint-desc" style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>
                Works in any agent session. Your agent fetches the skills index and pulls matching skills on demand.
              </div>
            </div>
          </div>
          <div style={{
            padding: "14px 20px",
            background: "var(--bg-code)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <code style={{
              flex: 1, fontSize: "13px", color: "var(--text-secondary)",
              lineHeight: 1.5,
              minWidth: 0,
              overflowWrap: "break-word",
            }}>{prompt}</code>
            <CopyButton text={prompt} />
          </div>
        </div>
      </div>

      {/* Persistent: AGENTS.md */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, color: "var(--text-faint)",
          letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px",
        }}>Set it and forget it</div>

        <div style={{
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                Add AGENTS.md to your repo
              </div>
              <div className="endpoint-desc" style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>
                Commit once, every agent session auto-discovers ICP skills. Works with Claude Code, Cursor, Copilot, and others.
              </div>
            </div>
            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
              <CopyButton text={agentsMd} />
              <a href="/AGENTS.md" download="AGENTS.md"
                title="Download AGENTS.md"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: "26px", height: "26px", borderRadius: "4px",
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  textDecoration: "none",
                  flexShrink: 0,
                }}>
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M8 2v8M4.5 7.5 8 11l3.5-3.5M2.5 13.5h11" />
                </svg>
              </a>
            </div>
          </div>
          <div style={{
            padding: "14px 20px",
            background: "var(--bg-code)",
          }}>
            <code style={{
              fontSize: "13px", color: "var(--text-secondary)",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            }}>{agentsMd}</code>
          </div>
        </div>
        <p style={{
          fontSize: "13px", color: "var(--text-muted)", margin: "12px 0 0 0",
          fontFamily: SANS_FONT, lineHeight: 1.6,
        }}>
          For Claude Code, also add a <code style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>CLAUDE.md</code> that
          reads: <code style={{ fontSize: "12px", color: "var(--text-tertiary)" }}>Read and follow the instructions in AGENTS.md.</code>
        </p>
      </div>

      {/* CLI install */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, color: "var(--text-faint)",
          letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px",
        }}>Use the CLI</div>

        <div style={{
          border: "1px solid var(--border-default)",
          borderRadius: "10px",
          overflow: "hidden",
          marginBottom: "8px",
        }}>
          <div style={{
            padding: "14px 20px",
            background: "var(--bg-card-subtle)",
            display: "flex", alignItems: "center", gap: "12px",
            flexWrap: "wrap",
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                All skills
              </div>
              <div className="endpoint-desc" style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>
                Auto-detects your agents (Claude Code, Cursor, Copilot, and more) and writes the skills into their rules files.
              </div>
            </div>
          </div>
          <div style={{
            padding: "14px 20px",
            background: "var(--bg-code)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <code style={{
              flex: 1, fontSize: "13px", color: "var(--text-secondary)",
              minWidth: 0,
              overflowWrap: "break-word",
            }}>npx skills add dfinity/icskills</code>
            <CopyButton text="npx skills add dfinity/icskills" />
          </div>
        </div>

        <div style={{
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "2px" }}>
                Single skill
              </div>
              <div className="endpoint-desc" style={{ fontSize: "13px", color: "var(--text-muted)", fontFamily: SANS_FONT }}>
                Install one skill by name. Includes any reference files.
              </div>
            </div>
          </div>
          <div style={{
            padding: "14px 20px",
            background: "var(--bg-code)",
            display: "flex", alignItems: "center", gap: "8px",
          }}>
            <code style={{
              flex: 1, fontSize: "13px", color: "var(--text-secondary)",
              minWidth: 0,
              overflowWrap: "break-word",
            }}>npx skills add dfinity/icskills --skill ckbtc</code>
            <CopyButton text="npx skills add dfinity/icskills --skill ckbtc" />
          </div>
        </div>
      </div>

      {/* Discovery endpoints section */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          fontSize: "11px", fontWeight: 700, color: "var(--text-faint)",
          letterSpacing: "2px", textTransform: "uppercase", marginBottom: "16px",
        }}>Agent discovery endpoints</div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
