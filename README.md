# IC Skills

**Skills for agents, not docs for humans.**

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
| **What this is** | One paragraph. What the technology does. |
| **Prerequisites** | Exact versions. `dfx >= 0.24.0`, `ic-cdk >= 0.17`. |
| **Mistakes that break your build** | Numbered pitfalls that prevent hallucinations. |
| **Implementation** | Tested, copy-paste-correct code blocks. |
| **Deploy & Test** | Step-by-step commands for local and mainnet. |
| **Verification** | Concrete commands to confirm it works. |

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
| [certified-variables](skills/certified-variables/SKILL.md) | Data | Certified query responses |
| [vetkd](skills/vetkd/SKILL.md) | Crypto | Threshold key derivation for encryption |
| [wallet](skills/wallet/SKILL.md) | DevOps | Cycles management and canister lifecycle |

## Usage

### Drop into agent context

The simplest way — paste the raw skill file into your agent's system prompt or context window:

```
curl -s https://raw.githubusercontent.com/JoshDFN/icskills/main/skills/ckbtc/SKILL.md
```

### Claude Code (`.claude/skills/`)

```bash
# Clone the skills you need into your project
mkdir -p .claude/skills/ckbtc
curl -sL https://raw.githubusercontent.com/JoshDFN/icskills/main/skills/ckbtc/SKILL.md \
  > .claude/skills/ckbtc/SKILL.md
```

Claude Code automatically loads skill files from `.claude/skills/*/SKILL.md` into context.

### Cursor / Windsurf / Any Agent

Add the skill content to your agent's rules, instructions, or context file — whatever your tool supports. The files are plain markdown. No special tooling required.

## API (Planned)

The website documents a REST API for programmatic access:

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

## License

MIT
