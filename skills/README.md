# OpenClaw Skills

OpenClaw skills that give AI agents access to crypto trading, DeFi, and agent management capabilities.

## Install the Cobot Skill

```bash
openclaw skills install https://github.com/cobotgg/openclawagents/tree/main/skills/cobot
```

Or manually copy the `cobot/` directory into your OpenClaw skills folder:

```bash
git clone https://github.com/cobotgg/openclawagents.git
cp -r openclawagents/skills/cobot ~/.openclaw/skills/cobot
```

## What You Get

The Cobot skill adds **27 tools** to your OpenClaw agent:

| Category | Tools | Description |
|----------|-------|-------------|
| **Kalshi** | 7 | Trade event contracts (crypto, politics, sports, weather) |
| **Polymarket** | 7 | Trade prediction markets with USDC on Polygon |
| **Token Swaps** | 5 | Swap/bridge tokens across 20+ chains via LiFi |
| **Pump.fun** | 1 | Launch meme tokens on Solana |
| **Wallet** | 3 | Check balances, get addresses, list tokens |
| **Agent Registry** | 4 | Find, register, and rate on-chain AI agents |

## Prerequisites

1. **Cobot API Key** — Get one at https://app.cobot.gg (free to create)
2. **OpenClaw** — Install from https://openclaw.com

## Quick Start

```bash
# 1. Install the skill
openclaw skills install https://github.com/cobotgg/openclawagents/tree/main/skills/cobot

# 2. Add the MCP server with your API key
openclaw mcp add cobot \
  --url https://backend.cobot.gg/mcp \
  --header "Authorization: Bearer ck_YOUR_KEY_HERE"

# 3. Start using it
openclaw chat
> "What are the trending Kalshi markets for BTC?"
> "Swap 0.1 ETH to USDC on Base"
> "Search for trading agents on the registry"
```

## Skill Structure

```
cobot/
├── SKILL.md                        <- Main skill manifest (YAML frontmatter + instructions)
└── references/
    ├── kalshi-trading.md            <- Kalshi prediction market trading guide
    ├── polymarket-trading.md        <- Polymarket trading guide
    ├── token-swaps.md               <- Token swap & bridge guide (LiFi)
    ├── pumpfun-launch.md            <- Pump.fun token launch guide
    ├── agent-registry.md            <- Solana Agent Registry guide
    ├── api-key-setup.md             <- API key setup instructions
    └── mcp-integration.md           <- MCP server integration + all 27 tools reference
```

## Creating Your Own Skills

OpenClaw skills follow a simple format:

1. Create a directory with your skill name
2. Add a `SKILL.md` with YAML frontmatter:

```yaml
---
name: my-skill
description: >
  Describe when this skill should activate. This text is used by the AI
  to decide when to load your skill.
version: 1.0.0
author: your-name
---

# My Skill

Instructions for the AI go here in Markdown...
```

3. Add optional `references/` directory with detailed docs
4. Publish to GitHub or share the directory

The `description` field in the frontmatter is critical — it determines when the AI activates your skill. Be specific about the triggers (e.g., "when the user wants to trade prediction markets").

## License

MIT
