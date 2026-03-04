import ThemeToggle from "./ThemeToggle";
import CopyButton from "./CopyButton";
import { CategoryIcon, GitHubIcon } from "./Icons";
import { BASE_PATH, SITE_URL } from "../data/site";

interface Props {
  skillName: string;
  skillTitle: string;
  category: string;
  lastUpdated: string;
}

export default function SkillHeader({ skillName, skillTitle, category, lastUpdated }: Props) {
  const rawUrl = `https://raw.githubusercontent.com/dfinity/icskills/main/skills/${skillName}/SKILL.md`;
  const githubUrl = `https://github.com/dfinity/icskills/blob/main/skills/${skillName}/SKILL.md`;
  const shareUrl = `${SITE_URL}/skills/${skillName}/`;

  return (
    <>
      {/* Header */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        borderBottom: "1px solid rgba(var(--accent-rgb),0.12)",
        padding: "0 32px",
        background: "var(--bg-header)", backdropFilter: "blur(12px)",
      }}>
        <div style={{
          maxWidth: "860px", margin: "0 auto",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          minHeight: "56px", flexWrap: "wrap", padding: "8px 0",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
            <a href={`${BASE_PATH}/`} style={{
              display: "flex", alignItems: "center", gap: "8px",
              color: "var(--text-muted)", textDecoration: "none", fontSize: "12px",
              padding: "6px 12px", borderRadius: "6px",
              border: "1px solid var(--border-default)",
              background: "var(--bg-card)",
              transition: "all 0.15s",
              flexShrink: 0,
            }}>
              <span style={{ fontSize: "14px" }}>{"\u2190"}</span>
              All Skills
            </a>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
              fontSize: "14px", color: "var(--text-primary)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0,
            }}>{skillTitle}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <a href={githubUrl} target="_blank" rel="noopener noreferrer"
              title="View on GitHub"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "36px", height: "36px", borderRadius: "6px",
                color: "var(--text-faint)", background: "var(--bg-card)",
                border: "1px solid var(--border-default)", transition: "color 0.2s",
              }}>
              <GitHubIcon />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content area intro */}
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "clamp(20px, 5vw, 40px) clamp(16px, 4vw, 32px) 0" }}>
        {/* Share bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          marginBottom: "24px", gap: "8px",
        }}>
          <CopyButton text={shareUrl} label="share this page" />
        </div>

        {/* Metadata bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px",
          flexWrap: "wrap",
        }}>
          <span style={{
            display: "flex", alignItems: "center", gap: "6px",
            fontSize: "11px", color: "var(--text-muted)",
            padding: "4px 12px", borderRadius: "6px",
            background: "rgba(var(--accent-rgb),0.06)",
            border: "1px solid rgba(var(--accent-rgb),0.12)",
          }}>
            <CategoryIcon category={category} size={14} />
            {category}
          </span>
          <span style={{ fontSize: "11px", color: "var(--text-ghost)" }}>
            updated {lastUpdated}
          </span>
        </div>

        {/* Agent context bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          marginBottom: "32px", padding: "12px 16px",
          background: "var(--bg-code)",
          border: "1px solid var(--border-default)",
          borderRadius: "8px",
        }}>
          <span style={{ fontSize: "11px", color: "var(--text-ghost)", whiteSpace: "nowrap", flexShrink: 0 }}>
            paste in agent:
          </span>
          <code style={{
            flex: 1, fontSize: "11px", color: "var(--accent)",
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            minWidth: 0,
          }}>
            {rawUrl}
          </code>
          <CopyButton text={`${rawUrl}`} />
        </div>
      </div>
    </>
  );
}
