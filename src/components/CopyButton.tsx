import { useState } from "preact/hooks";

interface Props {
  text: string;
  label?: string;
}

export default function CopyButton({ text, label }: Props) {
  const [copied, setCopied] = useState(false);
  const onClick = (e: Event) => {
    e.stopPropagation();
    e.preventDefault();
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={onClick} title={label || "Copy"} className="copy-btn" style={{
      background: copied ? "rgba(var(--green-rgb),0.1)" : "var(--bg-card)",
      border: `1px solid ${copied ? "rgba(var(--green-rgb),0.2)" : "var(--border-default)"}`,
      borderRadius: "4px", cursor: "pointer", padding: "5px", flexShrink: 0,
      color: copied ? "var(--green)" : "var(--text-muted)",
      lineHeight: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      width: "26px", height: "26px",
    }}>
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
      )}
    </button>
  );
}
