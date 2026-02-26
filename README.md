# IC Skills

🌐 **https://dfinity.github.io/icskills**

> **⚠️ Under active development** — Skill files are being reviewed and signed off by DFINITY engineers. Content may change. Feedback and PRs are welcome.

**Agent-readable instructions for every IC need.**

Structured, versioned, agent-readable skill files for every Internet Computer capability. Your AI reads the skill. It builds correctly. No hallucinations.

---

## The Problem

AI agents building on the Internet Computer hallucinate canister IDs, use deprecated APIs, and miss critical pitfalls. Traditional documentation is written for humans to browse — not for agents to consume programmatically.

## The Solution

Each skill is a single markdown file containing everything an agent needs to build correctly:

```
skills/ckbtc/SKILL.md
skills/internet-identity/SKILL.md
skills/stable-memory/SKILL.md
...
```

Every skill follows the same structure:

| Section | Purpose |
|---------|---------|
| **What This Is** | One paragraph. What the technology does. |
| **Prerequisites** | Exact versions. `icp-cli >= 0.1.0`, `ic-cdk >= 0.19`. |
| **Canister IDs** *(optional)* | External canister principals for mainnet/testnet. |
| **How It Works** *(optional)* | Flow descriptions for multi-step processes. |
| **Mistakes That Break Your Build** | Numbered pitfalls that prevent hallucinations. |
| **Implementation** | Tested, copy-paste-correct code blocks. |
| **Deploy & Test** | Step-by-step commands for local and mainnet. |
| **Verify It Works** | Concrete commands to confirm it works. |

The pitfalls section is the highest-value part. Every pitfall documented is a hallucination prevented.

## Skills

| Skill | Category | Description |
|-------|----------|-------------|
| [ckbtc](skills/ckbtc/SKILL.md) | DeFi | Accept, send, and manage chain-key Bitcoin |
| [icrc-ledger](skills/icrc-ledger/SKILL.md) | Tokens | ICRC-1/ICRC-2 token ledger standard |
| [internet-identity](skills/internet-identity/SKILL.md) | Auth | Passkey authentication with Internet Identity |
| [multi-canister](skills/multi-canister/SKILL.md) | Architecture | Inter-canister calls and multi-canister design |
| [stable-memory](skills/stable-memory/SKILL.md) | Architecture | Persistent storage that survives upgrades |
| [https-outcalls](skills/https-outcalls/SKILL.md) | Integration | HTTP requests from canisters to external APIs |
| [evm-rpc](skills/evm-rpc/SKILL.md) | Integration | Read/write Ethereum from the IC |
| [sns-launch](skills/sns-launch/SKILL.md) | Governance | Configure and launch an SNS DAO |
| [asset-canister](skills/asset-canister/SKILL.md) | Frontend | Deploy frontend assets to the IC |
| [certified-variables](skills/certified-variables/SKILL.md) | Security | Certified query responses |
| [vetkd](skills/vetkd/SKILL.md) | Security | Threshold key derivation for encryption |
| [wallet](skills/wallet/SKILL.md) | Infrastructure | Cycles management and canister lifecycle |

## Usage

### Drop into agent context

The simplest way — paste the raw skill file into your agent's system prompt or context window:

```
curl -s https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md
```

### Claude Code

Fetch the raw skill and paste it into context, or use it as a custom slash command:

```bash
# Fetch directly in conversation
curl -sL https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md
```

### OpenCode

Add skills as remote instructions in `opencode.json`:

```json
{
  "instructions": [
    "https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md",
    "https://raw.githubusercontent.com/dfinity/icskills/main/skills/internet-identity/SKILL.md"
  ]
}
```

Or copy into `.opencode/rules/` for automatic discovery:

```bash
mkdir -p .opencode/rules
curl -sL https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md \
  > .opencode/rules/ckbtc.md
```

### OpenClaw

Install as a skill or paste into your assistant's context during conversation. OpenClaw can also fetch skills directly from URLs when asked.

### Cursor

Add to `.cursor/rules/`:

```bash
mkdir -p .cursor/rules
curl -sL https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md \
  > .cursor/rules/ckbtc.md
```

### Windsurf

Add to `.windsurfrules` or paste into Windsurf's custom instructions.

### GitHub Copilot

Add to `.github/copilot-instructions.md`:

```bash
mkdir -p .github
curl -sL https://raw.githubusercontent.com/dfinity/icskills/main/skills/ckbtc/SKILL.md \
  >> .github/copilot-instructions.md
```

### Any Other Agent

The files are plain markdown. Copy the content into whatever instructions, rules, or context file your tool supports.

## Programmatic Access

| Resource | URL | Description |
|----------|-----|-------------|
| Skill index | [`llms.txt`](https://dfinity.github.io/icskills/llms.txt) | Short index with links to each skill |
| All skills | [`llms-full.txt`](https://dfinity.github.io/icskills/llms-full.txt) | All skills concatenated for direct context injection |
| Single skill | `https://raw.githubusercontent.com/dfinity/icskills/main/skills/{id}/SKILL.md` | Raw markdown for one skill |
| Agent discovery | [`.well-known/agent.json`](https://dfinity.github.io/icskills/.well-known/agent.json) | Machine-readable skill manifest |

## REST API (Planned)

| Endpoint | Description |
|----------|-------------|
| `GET /skills` | List all skills with metadata |
| `GET /skills/{id}` | Full structured skill data |
| `GET /skills/{id}/raw` | Raw SKILL.md for direct context injection |
| `GET /skills/{id}/deps` | Dependency tree |
| `GET /skills/search?q={query}` | Search by task description |
| `GET /skills/{id}/pitfalls` | Just the pitfalls (guardrails only) |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to add or update skills.

**All PRs require repo admin approval.** One skill per PR. Code examples must be tested.

## Tech Stack

- **Site**: [Preact](https://preactjs.com/) + [Vite](https://vite.dev/) — 3kb runtime, ~16kb gzipped total
- **Hosting**: GitHub Pages via Actions
- **Skills**: Plain markdown files in `skills/*/SKILL.md`
- **Validation**: Structural linter for frontmatter, sections, and dependency graph (`npm run validate`)
- **Schema**: JSON Schema for frontmatter at `skills/skill.schema.json`

## License

MIT
