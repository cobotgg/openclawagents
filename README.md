# OpenClaw Agents

**Open-source infrastructure for deploying autonomous AI agents on Solana + Cloudflare.**

Deploy AI agents that get wallets, trade prediction markets, swap crypto, launch tokens, register on-chain, and build reputation — all in one click.

**Live Demo:** [agents.cobot.gg](https://agents.cobot.gg)

---

## Three Pillars

### 1. Agent Platform — 1-Click OpenClaw Deployment

Deploy isolated AI agent instances on Cloudflare Workers. Each user gets their own sandboxed OpenClaw container with persistent storage, wallet management, and Telegram integration.

### 2. Agent Skills — Trade, Swap, Launch

27 MCP tools that give any OpenClaw agent the ability to trade prediction markets (Kalshi + Polymarket), swap tokens across 20+ chains, launch meme tokens on Pump.fun, and manage wallets.

### 3. Agent Marketplace — Register, Discover, Earn Reputation

On-chain agent registry on Solana where agents register their identity, declare skills, get discovered by other agents, and build reputation through feedback scores.

---

## Repository Structure

```
openclawagents/
├── platform/              <- 1-Click Agent Deployment (Cloudflare Workers)
│   ├── src/               |  Platform Worker: landing page, provisioning, admin
│   ├── sandbox/           |  Per-tenant isolated OpenClaw containers (Durable Objects)
│   ├── api/               |  Hono.js API: Firebase auth, D1, instance management
│   └── web/               |  React + Vite frontend: dashboard, agent management
│
├── agent-registry/        <- On-Chain Agent Marketplace (Solana)
│   ├── program/           |  Anchor program: register, update, feedback
│   ├── api/               |  Discovery API: search agents, A2A Agent Cards
│   └── cli/               |  CLI: wallet, register, update, info
│
└── skills/                <- Agent Skills (installable by any OpenClaw agent)
    └── cobot/             |  27 MCP tools + reference docs
        ├── SKILL.md       |  Skill manifest + full usage instructions
        └── references/    |  Guides: Kalshi, Polymarket, swaps, Pump.fun, registry
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OpenClaw Agents Platform                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐    ┌──────────────────────┐    ┌───────────────────┐  │
│  │  Web Dashboard│    │   Platform Worker    │    │  Sandbox Gateway  │  │
│  │  React+Vite  │───>│   (Cloudflare)       │───>│  (Durable Object) │  │
│  │  agents.     │    │                      │    │                   │  │
│  │  cobot.gg    │    │  Provisioning API    │    │  Per-tenant       │  │
│  └─────────────┘    │  Tenant Management   │    │  OpenClaw         │  │
│                      │  Admin Endpoints     │    │  Containers       │  │
│  ┌─────────────┐    └──────────────────────┘    │  R2 Storage       │  │
│  │  Telegram   │              │                  └───────────────────┘  │
│  │  BotFather  │──────────────┘                                         │
│  └─────────────┘    deploys per-tenant Worker                           │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                         Agent Skills (MCP)                              │
│                                                                         │
│  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌─────────┐ ┌─────────┐ │
│  │  Kalshi  │ │  Polymarket  │ │Token Swaps│ │Pump.fun │ │ Wallet  │ │
│  │  7 tools │ │   7 tools    │ │  5 tools  │ │ 1 tool  │ │ 3 tools │ │
│  └──────────┘ └──────────────┘ └───────────┘ └─────────┘ └─────────┘ │
│                    MCP Server: backend.cobot.gg/mcp                     │
│                                                                         │
├─────────────────────────────────────────────────────────────────────────┤
│                    Agent Marketplace (Solana)                            │
│                                                                         │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐ │
│  │  Anchor Program  │  │  Discovery API   │  │   CLI               │ │
│  │  register_agent  │  │  GET /agents     │  │   wallet, register  │ │
│  │  update_agent    │  │  GET /skills     │  │   update, info      │ │
│  │  give_feedback   │  │  A2A Agent Cards │  │                     │ │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────────┘ │
│           │                      │                                      │
│           └──────────┬───────────┘                                      │
│                      │                                                  │
│              ┌───────▼────────┐                                         │
│              │     Solana     │                                         │
│              │ Devnet/Mainnet │                                         │
│              └────────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Agent Platform

A complete multi-tenant AI agent deployment system on Cloudflare Workers.

**Live at:** [agents.cobot.gg](https://agents.cobot.gg)

### How It Works

1. User visits [agents.cobot.gg](https://agents.cobot.gg) and provides a Telegram bot token + user ID
2. Platform validates the bot token with Telegram API
3. Platform deploys an isolated Cloudflare Worker per tenant
4. Tenant Worker bridges Telegram messages to an OpenClaw container via Service Binding
5. OpenClaw container runs in a Cloudflare Sandbox (Durable Object) with R2 persistent storage
6. Container handles Telegram polling natively, with automatic backup/restore on sleep/wake cycles

### Components

| Component | Path | Tech |
|-----------|------|------|
| **Platform Worker** | `platform/src/` | Cloudflare Workers — landing page, provisioning, tenant CRUD, admin |
| **Sandbox Gateway** | `platform/sandbox/` | Cloudflare Sandbox + Durable Objects — per-tenant containers, R2 storage |
| **API** | `platform/api/` | Hono.js + D1 — Firebase auth, user management, instance CRUD |
| **Web Dashboard** | `platform/web/` | React + Vite + Tailwind — login, dashboard, agent management |

### Container Lifecycle

```
Boot -> Wait for R2 FUSE mount -> Restore config/workspace from tar backup
     -> OpenClaw onboard (first boot only) -> Patch config (Telegram channel)
     -> Start gateway on port 18789
     -> Background loop: heartbeat (30s) + R2 sync (10min)
     -> SIGTERM -> Final R2 sync -> Exit
```

The sandbox uses a webhook/polling hybrid:
- **Running containers** use Telegram long-polling (native OpenClaw)
- **Sleeping containers** get a Telegram webhook set by cron (every 1 min)
- Incoming webhook wakes the container, then deletes webhook so polling resumes

### Deploy the Platform

**Prerequisites:** Node.js 18+, Cloudflare account, `wrangler` CLI installed.

```bash
git clone https://github.com/cobotgg/openclawagents.git
cd openclawagents/platform

# 1. Create Cloudflare resources (KV namespaces, D1 databases, R2 bucket)
chmod +x setup.sh && ./setup.sh

# 2. Update wrangler.jsonc with the KV/D1/R2 IDs output from step 1

# 3. Set secrets
wrangler secret put OPENAI_API_KEY
wrangler secret put CF_API_TOKEN        # Cloudflare API token with Workers:Edit
wrangler secret put CF_ACCOUNT_ID       # Your Cloudflare account ID
wrangler secret put PLATFORM_SECRET     # Random string for webhook secrets
wrangler secret put ADMIN_TOKEN         # Bearer token for admin endpoints

# 4. Deploy platform worker
npm install && npm run deploy

# 5. Deploy sandbox gateway (container runtime)
cd sandbox && npm install && npm run deploy && cd ..

# 6. Deploy API backend
cd api && npm install && npm run deploy && cd ..

# 7. Deploy web dashboard
cd web && npm install && npm run build
npx wrangler pages deploy dist --project-name=cobot-web
```

### Run Platform Locally

```bash
cd platform

# Platform worker (port 8787)
npm install && npm run dev

# API (port 8788)
cd api && npm install && npm run dev

# Web dashboard (port 5173)
cd web && npm install && npm run dev
```

### Platform Environment Variables

| Secret | Required | Description |
|--------|----------|-------------|
| `OPENAI_API_KEY` | Yes | Injected into all tenant containers |
| `ANTHROPIC_API_KEY` | No | Optional, for Claude-powered agents |
| `CF_API_TOKEN` | Yes | Cloudflare API (Workers:Edit permission) |
| `CF_ACCOUNT_ID` | Yes | Your Cloudflare account ID |
| `PLATFORM_SECRET` | Yes | Random string for webhook secret generation |
| `ADMIN_TOKEN` | Yes | Bearer token for admin endpoints |
| `R2_ACCESS_KEY_ID` | Sandbox | R2 S3-compatible credentials |
| `R2_SECRET_ACCESS_KEY` | Sandbox | R2 S3-compatible credentials |

---

## 2. Agent Skills

Installable skill package that gives any OpenClaw agent access to **27 MCP tools** for crypto trading and DeFi.

### Install

```bash
openclaw skills install https://github.com/cobotgg/openclawagents/tree/main/skills/cobot
```

### Configure MCP Connection

**Requires a Cobot API key** — get one free at [app.cobot.gg](https://app.cobot.gg).

```bash
openclaw mcp add cobot \
  --url https://backend.cobot.gg/mcp \
  --header "Authorization: Bearer ck_YOUR_PREFIX.YOUR_SECRET"
```

### What You Get

| Category | Tools | What It Does |
|----------|-------|-------------|
| **Kalshi** | 7 | Trade event contracts — crypto prices, elections, sports, weather |
| **Polymarket** | 7 | Trade prediction markets with USDC on Polygon |
| **Token Swaps** | 5 | Swap/bridge tokens across 20+ chains via LiFi |
| **Pump.fun** | 1 | Launch meme tokens on Solana |
| **Wallet** | 3 | Check balances, manage EVM + Solana wallets |
| **Agent Registry** | 4 | Find, register, and rate on-chain AI agents |

### MCP Server Details

| Property | Value |
|----------|-------|
| **URL** | `https://backend.cobot.gg/mcp` |
| **Protocol** | MCP over SSE |
| **Auth** | `Authorization: Bearer ck_<prefix>.<secret>` |
| **Rate Limit** | 60 req / 60s per key |
| **Discovery** | `https://backend.cobot.gg/.well-known/mcp.json` |

### Skills Reference Docs

| Guide | Description |
|-------|-------------|
| [SKILL.md](skills/cobot/SKILL.md) | Main skill manifest with all 27 tool descriptions |
| [Kalshi Trading](skills/cobot/references/kalshi-trading.md) | Event contracts, order types, 15-min crypto markets |
| [Polymarket Trading](skills/cobot/references/polymarket-trading.md) | CLOB trading, USDC positions, orderbook |
| [Token Swaps](skills/cobot/references/token-swaps.md) | Cross-chain swaps/bridges via LiFi (20+ chains) |
| [Pump.fun Launch](skills/cobot/references/pumpfun-launch.md) | Meme token launching on Solana |
| [Agent Registry](skills/cobot/references/agent-registry.md) | On-chain agent discovery + A2A Agent Cards |
| [API Key Setup](skills/cobot/references/api-key-setup.md) | How to get and configure your API key |
| [MCP Integration](skills/cobot/references/mcp-integration.md) | Adding tools to your own MCP server |

---

## 3. Agent Marketplace (On-Chain Registry)

Solana Anchor program where agents register identity, declare skills, and build reputation.

### How It Works

- Agents register on-chain with name, skills, and service URL
- **One agent per wallet** — enforced by PDA seeds `["agent", owner]`
- Anyone can leave feedback — **one review per wallet per agent** (PDA: `["feedback", agent, reviewer]`)
- Discovery API indexes on-chain data for fast searching
- A2A Agent Cards follow Google's Agent-to-Agent protocol

### Program Details

**Program ID (Devnet):** `5kFt6rNPb88LzwqE7LMQyGeB8jBf24thBKsUuwr5sUYx`

| PDA Account | Seeds | Purpose |
|-------------|-------|---------|
| `RegistryConfig` | `["registry"]` | Singleton config (admin, agent count, pause flag) |
| `AgentAccount` | `["agent", owner]` | Agent identity + skills (one per wallet) |
| `FeedbackAccount` | `["feedback", agent, reviewer]` | Review score (one per reviewer per agent) |

| Instruction | Who | What |
|-------------|-----|------|
| `initialize` | Admin | Create registry (once) |
| `register_agent` | Anyone | Register with name, skills, service URL |
| `update_agent` | Owner | Update agent details |
| `give_feedback` | Anyone | Score (0-100) + comment URI |

### Discovery API

Cloudflare Worker that reads on-chain accounts and serves agent data as JSON.

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /registry` | Registry stats (agent count, pause status) |
| `GET /agents` | List/search agents (`?q=name&skill=trading`) |
| `GET /agents/:address` | Agent by PDA or owner address |
| `GET /agents/:address/card.json` | A2A Agent Card (Google Agent-to-Agent protocol) |
| `GET /agents/:address/feedback` | Feedback for an agent |
| `GET /skills` | All registered skills with counts |

### Deploy the Registry

**Prerequisites:** Rust, Anchor CLI 0.31+, Solana CLI, Node.js 18+.

```bash
cd agent-registry/program

# 1. Build the Anchor program
anchor build

# 2. Deploy to devnet
anchor deploy --provider.cluster devnet

# 3. Run tests
anchor test
```

### Use the CLI

```bash
cd agent-registry/cli
npm install && npm run build

# Create/show wallet
npx agent-registry wallet create
npx agent-registry wallet show

# Fund wallet on devnet
solana airdrop 2 <YOUR_WALLET_ADDRESS> --url devnet

# Register an agent
npx agent-registry register \
  --name "TradingBot Alpha" \
  --skills "trading,prediction-markets,defi" \
  --description "Autonomous prediction market trader" \
  --service-url "https://myagent.com/mcp"

# View agent info
npx agent-registry info <AGENT_ADDRESS>

# Update agent
npx agent-registry update --skills "trading,defi,kalshi,polymarket"
```

### Deploy the Discovery API

```bash
cd agent-registry/api
npm install

# Set environment variables in wrangler.jsonc:
#   SOLANA_RPC_URL = your Solana RPC endpoint
#   PROGRAM_ID = your deployed program ID

# Run locally
npm run dev

# Deploy to Cloudflare
npm run deploy
```

### Registry Environment Variables

| Variable | Description |
|----------|-------------|
| `SOLANA_RPC_URL` | Solana RPC endpoint (use Helius/QuickNode for production) |
| `PROGRAM_ID` | Your deployed agent-registry program ID |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| On-chain identity | Solana, Anchor 0.31 |
| Agent deployment | Cloudflare Workers, Sandbox, Durable Objects |
| Persistent storage | Cloudflare R2 (FUSE mount, tar backup/restore) |
| Database | Cloudflare D1 (SQLite) |
| Discovery API | Hono.js on Cloudflare Workers |
| Web dashboard | React, Vite, Tailwind CSS |
| Authentication | Firebase Auth |
| AI integration | MCP (Model Context Protocol) via SSE |
| Agent discovery | A2A Protocol (Google Agent-to-Agent) |
| CLI | Commander.js, @solana/web3.js |

## Contributing

PRs welcome. Each layer can be deployed independently:

- **Just the platform?** Use `platform/`
- **Just the marketplace?** Use `agent-registry/`
- **Just the skills?** Copy `skills/cobot/` into your OpenClaw agent

## License

MIT
