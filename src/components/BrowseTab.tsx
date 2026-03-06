import { useState, useEffect, useMemo } from "preact/hooks";
import type { Skill } from "../data/skills";
import { SANS_FONT } from "../data/constants";
import { CategoryIcon } from "./Icons";
import CopyButton from "./CopyButton";

interface Props {
  skills: Skill[];
}

export default function BrowseTab({ skills }: Props) {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(skills.map((s) => s.category))).sort()],
    [skills]
  );
  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return skills.filter((s) => {
      const matchCat = activeCategory === "All" || s.category === activeCategory;
      const matchSearch = s.title.toLowerCase().includes(query) || s.description.toLowerCase().includes(query);
      return matchCat && matchSearch;
    });
  }, [searchQuery, activeCategory, skills]);

  return (
    <>
      {/* Hero */}
      <div style={{ marginBottom: "48px" }}>
        <h1 style={{
          fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800,
          lineHeight: 1.1, margin: "0 0 16px 0",
          letterSpacing: "-2px", color: "var(--text-primary)",
        }}>
          Agent-readable instructions<br />for every IC need.
        </h1>
        <p style={{
          fontSize: "15px", color: "var(--text-tertiary)", maxWidth: "560px",
          lineHeight: 1.6, margin: 0, fontFamily: SANS_FONT,
        }}>
          The missing context layer between AI agents and the Internet Computer.
        </p>
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
              fontSize: "15px", outline: "none",
              fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
        </div>
        <div className="endpoint-hint" style={{
          padding: "10px 16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px", fontSize: "13px", color: "var(--text-secondary)",
          whiteSpace: "nowrap",
          display: "flex", alignItems: "center", gap: "8px",
        }}>
          <code style={{ fontSize: "13px", color: "var(--text-secondary)" }}>npx skills add dfinity/icskills</code>
          <CopyButton text="npx skills add dfinity/icskills" />
        </div>
      </div>

      {/* Category filters */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "32px", flexWrap: "wrap" }}>
        {categories.map((cat) => (
          <button key={cat} className="category-pill" onClick={() => setActiveCategory(cat)} style={{
            padding: "6px 14px", fontSize: "13px",
            background: activeCategory === cat ? "var(--bg-input)" : "var(--bg-card)",
            border: `1px solid ${activeCategory === cat ? "var(--border-strong)" : "var(--border-default)"}`,
            borderRadius: "6px",
            color: activeCategory === cat ? "var(--text-primary)" : "var(--text-muted)",
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
          const rawUrl = `${origin}/.well-known/skills/${skill.name}/SKILL.md`;
          return (
            <div
              key={skill.name}
              role="link"
              tabIndex={0}
              onClick={() => { window.location.href = `/skills/${skill.name}/`; }}
              onKeyDown={(e) => { if (e.key === "Enter") window.location.href = `/skills/${skill.name}/`; }}
              className="skill-card"
              style={{
                padding: "24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "5px",
                cursor: "pointer",
                color: "inherit",
                display: "block",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                <span style={{
                  fontSize: "18px", width: "36px", height: "36px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "var(--bg-input)",
                  borderRadius: "8px", color: "var(--text-secondary)",
                  flexShrink: 0,
                }}><CategoryIcon category={skill.category} /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {skill.title}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "2px" }}>
                    {skill.category}
                  </div>
                </div>
                <a href={`https://github.com/dfinity/icskills/blob/main/skills/${skill.name}/SKILL.md`}
                  target="_blank" rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="View on GitHub" aria-label={`View ${skill.title} on GitHub`}
                  className="github-link"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "36px", height: "36px", borderRadius: "6px",
                    color: "var(--text-faint)", flexShrink: 0,
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                  }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                </a>
              </div>

              <p style={{
                fontSize: "14px", color: "var(--text-dim)", lineHeight: 1.6,
                margin: "0 0 16px 0", fontFamily: SANS_FONT,
              }}>{skill.description}</p>

              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                updated {skill.lastUpdated}
              </div>

              <div
                className="card-agent-url"
                onClick={(e) => e.stopPropagation()}
                style={{
                  marginTop: "12px", paddingTop: "12px",
                  borderTop: "1px solid var(--border-subtle)",
                  display: "flex", alignItems: "center", gap: "8px",
                  cursor: "default",
                }}>
                <div style={{
                  fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", flexShrink: 0,
                }}>
                  paste in agent:
                </div>
                <code style={{
                  flex: 1, padding: "6px 10px",
                  background: "var(--bg-code)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "4px", fontSize: "11px", color: "var(--text-tertiary)",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  minWidth: 0,
                }}>
                  {rawUrl}
                </code>
                <CopyButton text={rawUrl} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
