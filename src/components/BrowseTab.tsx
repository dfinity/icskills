import { useState, useMemo } from "preact/hooks";
import type { Skill } from "../data/skills";
import { SANS_FONT } from "../data/constants";
import { BASE_PATH } from "../data/site";
import { CategoryIcon } from "./Icons";
import CopyButton from "./CopyButton";

interface Props {
  skills: Skill[];
}

export default function BrowseTab({ skills }: Props) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(skills.map((s) => s.category))).sort()],
    [skills]
  );
  const TOTAL_ENDPOINTS = useMemo(() => skills.reduce((sum, s) => sum + s.endpoints, 0), [skills]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return skills.filter((s) => {
      const matchCat = activeCategory === "All" || s.category === activeCategory;
      const matchSearch = s.name.toLowerCase().includes(query) || s.description.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });
  }, [searchQuery, activeCategory, skills]);

  return (
    <>
      {/* Hero */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{
          fontSize: "11px", color: "var(--accent)", letterSpacing: "3px",
          textTransform: "uppercase", marginBottom: "16px",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <span style={{ display: "inline-block", width: "24px", height: "1px", background: "var(--accent)" }} />
          ICP Skills
        </div>
        <h1 style={{
          fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800,
          lineHeight: 1.1, margin: "0 0 16px 0",
          letterSpacing: "-2px",
          background: "var(--gradient-hero)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Agent-readable instructions<br />for every IC need.
        </h1>
        <p style={{
          fontSize: "15px", color: "var(--text-tertiary)", maxWidth: "560px",
          lineHeight: 1.6, margin: 0, fontFamily: SANS_FONT,
        }}>
          One API call, zero hallucinations. Structured skill files with correct canister IDs,
          tested code, known pitfalls, and verification checks.
        </p>

        {/* Stats */}
        <div className="hero-stats" style={{ display: "flex", gap: "32px", marginTop: "32px" }}>
          {[
            { val: skills.length, label: "Skills" },
            { val: TOTAL_ENDPOINTS, label: "Operations" },
            { val: "5", label: "Endpoints" },
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
            onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
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
          fetch("dfinity.github.io/icskills/api/v1/skills/{"{"}
          <span style={{ color: "var(--accent-blue)" }}>id</span>
          {"}"}")
        </div>
      </div>

      {/* Category filters */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "32px", flexWrap: "wrap" }}>
        {categories.map((cat) => (
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
        {filtered.map((skill) => {
          const rawUrl = `https://raw.githubusercontent.com/dfinity/icskills/main/skills/${skill.id}/SKILL.md`;
          const fetchCmd = `curl -sL ${rawUrl}`;
          return (
            <a
              key={skill.id}
              href={`${BASE_PATH}/skills/${skill.id}/`}
              className="skill-card"
              style={{
                padding: "24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "12px",
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
                display: "block",
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
                <div style={{ minWidth: 0, flex: 1 }}>
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
                <a href={`https://github.com/dfinity/icskills/blob/main/skills/${skill.id}/SKILL.md`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="View on GitHub" aria-label={`View ${skill.name} on GitHub`}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "36px", height: "36px", borderRadius: "6px",
                    color: "var(--text-faint)", flexShrink: 0,
                    background: `rgba(var(--accent-rgb),0.06)`,
                    border: `1px solid rgba(var(--accent-rgb),0.1)`,
                    transition: "color 0.2s, border-color 0.2s",
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
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

              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginTop: "12px", paddingTop: "12px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", gap: "8px",
                }}>
                <div style={{
                  fontSize: "10px", color: "var(--text-ghost)", whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  paste in agent:
                </div>
                <code style={{
                  flex: 1, padding: "6px 10px",
                  background: "var(--bg-code)",
                  border: `1px solid rgba(var(--accent-rgb),0.1)`,
                  borderRadius: "4px", fontSize: "10px", color: "var(--accent)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  minWidth: 0,
                }}>
                  {fetchCmd}
                </code>
                <CopyButton text={fetchCmd} />
              </div>
            </a>
          );
        })}
      </div>
    </>
  );
}
