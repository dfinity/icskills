// All SVG icons — exact copies from the original app.jsx

export function CategoryIcon({ category, size = 18 }: { category: string; size?: number }) {
  const common = {
    width: size, height: size, viewBox: "0 0 18 18",
    fill: "none", stroke: "currentColor", "stroke-width": "1.5",
    "stroke-linecap": "round" as const, "stroke-linejoin": "round" as const,
  };
  switch (category) {
    case "Architecture":
      return (<svg {...common}><path d="M9 2L2 6l7 4 7-4z" /><path d="M2 9l7 4 7-4" /><path d="M2 12l7 4 7-4" /></svg>);
    case "Auth":
      return (<svg {...common}><path d="M6 8V5.5a3 3 0 016 0V8" /><path d="M4 8h10a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /></svg>);
    case "DeFi":
      return (<svg {...common}><path d="M2 14l4-5 3 2.5L16 4" /><path d="M12 4h4v4" /></svg>);
    case "Frontend":
      return (<svg {...common}><path d="M2.5 4h13a1 1 0 011 1v9a1 1 0 01-1 1h-13a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M1.5 7h15" /></svg>);
    case "Governance":
      return (<svg {...common}><path d="M2 15h14" /><path d="M4 15V8" /><path d="M9 15V8" /><path d="M14 15V8" /><path d="M2 8l7-5.5 7 5.5" /></svg>);
    case "Infrastructure":
      return (<svg {...common}><circle cx="9" cy="9" r="2.5" /><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M3.8 14.2l1.4-1.4M12.8 5.2l1.4-1.4" /></svg>);
    case "Integration":
      return (<svg {...common}><path d="M7 11L5 13a2.8 2.8 0 01-4-4l2-2" /><path d="M11 7l2-2a2.8 2.8 0 014 4l-2 2" /><path d="M7 11l4-4" /></svg>);
    case "Security":
      return (<svg {...common}><path d="M9 1.5L3 4.5v4c0 4 2.5 7 6 8.5 3.5-1.5 6-4.5 6-8.5v-4z" /></svg>);
    case "Tokens":
      return (<svg {...common}><path d="M9 2a7 7 0 100 14A7 7 0 009 2z" /><path d="M9 5v8" /><path d="M7 7.5h4" /><path d="M7 10.5h4" /></svg>);
    case "Wallet":
      return (<svg {...common}><path d="M3 5a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M13 9h2v3h-2a1.5 1.5 0 010-3z" /></svg>);
    default:
      return null;
  }
}

export function FrameworkIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const s = { width: size, height: size, viewBox: "0 0 24 24", style: { color } };
  switch (name) {
    case "Claude":
      return (<svg {...s} fill="currentColor"><path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z"/></svg>);
    case "ChatGPT":
      return (<svg {...s} fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.14-.08 4.778-2.758a.795.795 0 0 0 .393-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.677l5.814 3.354-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.856L13.104 8.364l2.015-1.164a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.098-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>);
    case "Cursor":
      return (<svg {...s} fill="none"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0" fill="currentColor" opacity="0.15"/><path d="M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" fill="currentColor"/></svg>);
    case "Devin":
      return (<svg {...s} fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M8 12H16M12 8V16" stroke-linecap="round"/></svg>);
    case "Copilot":
      return (<svg {...s} fill="currentColor"><path d="M23.922 16.997C23.061 18.492 18.063 22.02 12 22.02 5.937 22.02.939 18.492.078 16.997A.641.641 0 0 1 0 16.741v-2.869a.883.883 0 0 1 .053-.22c.372-.935 1.347-2.292 2.605-2.656.167-.429.414-1.055.644-1.517a10.098 10.098 0 0 1-.052-1.086c0-1.331.282-2.499 1.132-3.368.397-.406.89-.717 1.474-.952C7.255 2.937 9.248 1.98 11.978 1.98c2.731 0 4.767.957 6.166 2.093.584.235 1.077.546 1.474.952.85.869 1.132 2.037 1.132 3.368 0 .368-.014.733-.052 1.086.23.462.477 1.088.644 1.517 1.258.364 2.233 1.721 2.605 2.656a.841.841 0 0 1 .053.22v2.869a.641.641 0 0 1-.078.256zm-9.422 1.258c.549 0 1-.451 1-1v-2c0-.549-.451-1-1-1-.549 0-1 .451-1 1v2c0 .549.451 1 1 1zm-5 0c.549 0 1-.451 1-1v-2c0-.549-.451-1-1-1-.549 0-1 .451-1 1v2c0 .549.451 1 1 1z"/></svg>);
    case "Windsurf":
      return (<svg {...s} fill="currentColor"><path d="M23.55 5.067c-1.204-.002-2.181.973-2.181 2.177v4.867c0 .972-.803 1.76-1.76 1.76-.568 0-1.135-.286-1.472-.766l-4.971-7.1c-.413-.59-1.084-.941-1.81-.941-1.134 0-2.154.964-2.154 2.153v4.896c0 .972-.797 1.76-1.76 1.76-.57 0-1.136-.286-1.473-.766L.408 5.16C.282 4.98 0 5.069 0 5.288v4.245c0 .215.066.423.188.6l5.475 7.818c.323.462.8.805 1.351.93 1.377.313 2.644-.747 2.644-2.098v-4.893c0-.972.788-1.76 1.76-1.76h.003c.57 0 1.136.286 1.472.766l4.972 7.1c.414.59 1.05.94 1.81.94 1.158 0 2.151-.964 2.151-2.153v-4.895c0-.972.788-1.759 1.76-1.759h.194a.22.22 0 0 0 .22-.22V5.287a.22.22 0 0 0-.22-.22z"/></svg>);
    case "Claude Code":
      return (<svg {...s} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6L3 12L8 18"/><path d="M16 6L21 12L16 18"/><path d="M14 4L10 20" opacity="0.5"/></svg>);
    case "OpenCode":
      return (<svg {...s} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17L10 11L4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>);
    case "OpenClaw":
      return (<svg {...s} fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15.5v-2c-2.76 0-5-2.24-5-5h2c0 1.66 1.34 3 3 3v-2l4 3.5-4 3.5v-1zm6-4.5c0-1.66-1.34-3-3-3v2l-4-3.5L14 5v1c2.76 0 5 2.24 5 5h-2z"/></svg>);
    case "Your Agent":
      return (<svg {...s} fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L3 14H12L11 22L21 10H12L13 2Z"/></svg>);
    default:
      return null;
  }
}

export function GitHubIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}
