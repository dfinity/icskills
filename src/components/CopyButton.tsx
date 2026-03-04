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
    <button onClick={onClick} title={`Copy ${label || "command"}`} style={{
      background: copied ? "rgba(var(--green-rgb),0.1)" : "rgba(var(--accent-rgb),0.06)",
      border: `1px solid ${copied ? "rgba(var(--green-rgb),0.2)" : "rgba(var(--accent-rgb),0.1)"}`,
      borderRadius: "4px", cursor: "pointer", padding: "4px 8px", flexShrink: 0,
      color: copied ? "var(--green)" : "var(--text-faint)",
      fontSize: "10px", lineHeight: 1, transition: "all 0.2s",
      display: "flex", alignItems: "center", gap: "4px",
    }}>
      {copied ? "\u2713 copied" : label ? `\u2398 ${label}` : "\u2398 copy"}
    </button>
  );
}
