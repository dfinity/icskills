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
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);

  const categories = useMemo(
    () => ["All", ...Array.from(new Set(skills.map((s) => s.category))).sort()],
    [skills]
  );
  const filtered = useMemo(() => {
    return skills.filter((s) => {
      return activeCategory === "All" || s.category === activeCategory;
    });
  }, [activeCategory, skills]);

  const siteOrigin = origin || "https://skills.internetcomputer.org";
  const prompt = `Fetch ${siteOrigin}/llms.txt and follow its instructions when building on ICP`;

  return (
    <>
      {/* Hero */}
      <div style={{ marginBottom: "48px" }}>
        <h1 style={{
          fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 800,
          lineHeight: 1.1, margin: "0 0 16px 0",
          letterSpacing: "-2px", color: "var(--text-primary)",
        }}>
          ICP skills for agents that write code.
        </h1>
        <p style={{
          fontSize: "15px", color: "var(--text-tertiary)", maxWidth: "560px",
          lineHeight: 1.6, margin: "0 0 20px 0", fontFamily: SANS_FONT,
        }}>
          Build using sovereign software on an onchain open cloud that's tamperproof,
          unstoppable, and can process digital assets and payments
        </p>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => {
            navigator.clipboard.writeText(prompt).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 3000);
          }} className="copy-prompt-btn" style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "10px 20px", borderRadius: "8px",
            background: copied ? "rgba(var(--green-rgb),0.1)" : "var(--bg-input)",
            border: `1px solid ${copied ? "rgba(var(--green-rgb),0.2)" : "var(--border-strong)"}`,
            color: copied ? "var(--green)" : "var(--text-primary)",
            cursor: "pointer", fontSize: "14px", fontWeight: 600,
            fontFamily: SANS_FONT,
            transition: "all 0.15s ease",
          }}>
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
            )}
            <span style={{ display: "grid" }}>
              <span style={{ gridArea: "1/1", visibility: copied ? "visible" : "hidden" }}>Now paste into your agent</span>
              <span style={{ gridArea: "1/1", visibility: copied ? "hidden" : "visible" }}>Give your agent ICP skills</span>
            </span>
          </button>
          <a href="/get-started/" style={{
            fontSize: "14px", color: "var(--text-muted)",
            textDecoration: "none", fontFamily: SANS_FONT,
          }}>Get Started →</a>
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
          return (
            <div
              key={skill.name}
              className="skill-card"
              style={{
                padding: "24px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: "5px",
                cursor: "pointer",
                color: "inherit",
                display: "block",
                overflow: "hidden",
                position: "relative",
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
                  <a href={`/skills/${skill.name}/`} className="skill-card-link" style={{
                    fontSize: "16px", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.3px",
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    textDecoration: "none", display: "block",
                  }}>
                    {skill.title}
                  </a>
                  <div style={{ fontSize: "13px", color: "var(--text-faint)", marginTop: "2px" }}>
                    {skill.category}
                  </div>
                </div>
                <a href={skill.fileCount > 1
                    ? `/.well-known/skills/${skill.name}/SKILL.zip`
                    : `/.well-known/skills/${skill.name}/SKILL.md`}
                  download
                  title={skill.fileCount > 1 ? "Download skill (.zip)" : "Download skill (.md)"}
                  aria-label={`Download ${skill.title}`}
                  className="github-link"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    width: "36px", height: "36px", borderRadius: "6px",
                    color: "var(--text-faint)", flexShrink: 0,
                    background: "var(--bg-card-subtle)",
                    border: "1px solid var(--border-subtle)",
                  }}>
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M8 2v8M4.5 7.5 8 11l3.5-3.5M2.5 13.5h11" />
                  </svg>
                </a>
                <a href={`https://github.com/dfinity/icskills/blob/main/skills/${skill.name}/SKILL.md`}
                  target="_blank" rel="noopener noreferrer"
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
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
              }}>{skill.description}</p>

              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                updated {skill.lastUpdated}
              </div>

            </div>
          );
        })}
      </div>
    </>
  );
}
