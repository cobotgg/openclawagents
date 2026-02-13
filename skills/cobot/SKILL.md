---
name: cobot
description: >
  Activate this skill when the user wants to trade prediction markets (Kalshi, Polymarket),
  swap or bridge crypto tokens across chains, launch meme tokens on Pump.fun, manage wallets
  and balances, or discover and interact with on-chain AI agents on Solana. This skill connects
  to Cobot's MCP server which provides authenticated access to all these capabilities.
version: 1.0.0
author: cobot.gg
metadata:
  mcp_url: https://backend.cobot.gg/mcp
  docs_url: https://app.cobot.gg
  github: https://github.com/cobotgg/openclawagents
  category: crypto-trading
  tags:
    - prediction-markets
    - kalshi
    - polymarket
    - defi
    - token-swap
    - bridge
    - pumpfun
    - solana
    - agent-registry
---

# Cobot — Crypto Trading & Agent Skills for OpenClaw

You now have access to **27 tools** for crypto trading, DeFi operations, and AI agent management through Cobot's MCP server.

## Setup — API Key Required

**Before using any tool, the user MUST have a Cobot API key.**

If the user hasn't configured their API key yet, guide them through these steps:

1. Go to **https://app.cobot.gg** and create an account (Google sign-in supported)
2. Navigate to **Settings → API Keys**
3. Click **"Create API Key"** — this generates a key in the format `ck_<prefix>.<secret>`
4. **Copy the full key immediately** — the secret part is only shown once

Then configure the MCP connection in OpenClaw:

```bash
# Add the Cobot MCP server
openclaw mcp add cobot \
  --url https://backend.cobot.gg/mcp \
  --header "Authorization: Bearer ck_YOUR_PREFIX.YOUR_SECRET"
```

Or add it manually to `~/.openclaw/config.json`:

```json
{
  "mcpServers": {
    "cobot": {
      "url": "https://backend.cobot.gg/mcp",
      "headers": {
        "Authorization": "Bearer ck_YOUR_PREFIX.YOUR_SECRET"
      }
    }
  }
}
```

**Important:** The API key authenticates all requests. Without it, only read-only tools (agent search, agent profile) will work. Trading, swapping, and wallet operations all require authentication.

## MCP Server Details

- **URL:** `https://backend.cobot.gg/mcp`
- **Protocol:** MCP over SSE (Server-Sent Events)
- **Auth:** `Authorization: Bearer ck_<prefix>.<secret>`
- **Rate Limit:** 60 requests per 60 seconds per API key
- **Discovery:** `https://backend.cobot.gg/.well-known/mcp.json`

## Available Tools

### Prediction Markets — Kalshi (7 tools)

Trade event contracts on Kalshi (elections, weather, finance, crypto prices, sports).

| Tool | Auth | Description |
|------|------|-------------|
| `markets_list` | Yes | Search/filter Kalshi markets by status, series, event ticker |
| `market_get` | Yes | Get detailed info for a specific market by ticker |
| `events_list` | Yes | Browse Kalshi events with filtering |
| `orders_create` | Yes | Place buy/sell orders (market or limit) |
| `orders_list` | Yes | View your open and filled orders |
| `positions_list` | Yes | View your current positions and P&L |
| `position_close` | Yes | Close an existing position |

**Key parameters for `orders_create`:**
- `ticker` (required) — Market ticker (e.g., `KXBTCD-25FEB14-99250`)
- `side` — `yes` or `no`
- `type` — `market` or `limit`
- `count` — Number of contracts
- `price` — Limit price in cents (1-99)

See [references/kalshi-trading.md](references/kalshi-trading.md) for full trading guide.

### Prediction Markets — Polymarket (7 tools)

Trade on Polymarket (crypto, politics, current events, sports).

| Tool | Auth | Description |
|------|------|-------------|
| `polymarket_markets` | Yes | Search/browse Polymarket markets |
| `polymarket_events` | Yes | Browse Polymarket events |
| `polymarket_market_orderbook` | Yes | View orderbook for a market |
| `polymarket_place_order` | Yes | Place buy/sell orders |
| `polymarket_positions` | Yes | View your positions |
| `polymarket_open_orders` | Yes | View open orders |
| `polymarket_cancel_order` | Yes | Cancel an open order |

**Key parameters for `polymarket_place_order`:**
- `tokenId` (required) — The outcome token ID
- `side` — `BUY` or `SELL`
- `size` — Amount in USDC
- `price` — Price per share (0.01 - 0.99)

See [references/polymarket-trading.md](references/polymarket-trading.md) for full trading guide.

### Token Swaps & Bridges (5 tools)

Swap tokens on the same chain or bridge across chains via LiFi aggregator. Supports Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Solana, and 20+ more chains.

| Tool | Auth | Description |
|------|------|-------------|
| `swap_quote` | Yes | Get a swap/bridge quote with price, fees, and route |
| `swap_execute` | Yes | Execute a quoted swap/bridge transaction |
| `trending_tokens` | Yes | Get trending tokens by chain |
| `token_search` | Yes | Search for tokens by name or symbol |
| `token_info` | Yes | Get detailed token info (price, market cap, etc.) |

**Key parameters for `swap_quote`:**
- `fromChain` — Source chain (e.g., `ethereum`, `polygon`, `solana`)
- `toChain` — Destination chain
- `fromToken` — Token address or symbol (e.g., `USDC`, `ETH`)
- `toToken` — Target token address or symbol
- `amount` — Amount in human-readable units (e.g., `100` for 100 USDC)

See [references/token-swaps.md](references/token-swaps.md) for full swap/bridge guide.

### Token Launching — Pump.fun (1 tool)

Launch meme tokens on Solana via Pump.fun.

| Tool | Auth | Description |
|------|------|-------------|
| `pumpfun_launch_token` | Yes | Launch a new token on Pump.fun |

**Key parameters:**
- `name` — Token name
- `symbol` — Token ticker (e.g., `DOGE`)
- `description` — Token description
- `imageUrl` — Token logo URL
- `initialBuyAmount` — SOL amount for initial buy (optional)

See [references/pumpfun-launch.md](references/pumpfun-launch.md) for launch guide.

### Wallet Management (3 tools)

Check balances and manage wallets across EVM and Solana chains.

| Tool | Auth | Description |
|------|------|-------------|
| `balances_get` | Yes | Get token balances for a wallet across chains |
| `wallet_addresses` | Yes | Get your wallet addresses (EVM + Solana) |
| `tokens_by_chain` | Yes | List supported tokens for a specific chain |

### Agent Registry — Solana (4 tools)

Discover and interact with on-chain AI agents registered on the Solana Agent Registry.

| Tool | Auth | Description |
|------|------|-------------|
| `agent_search` | No | Search agents by name, skill, or description |
| `agent_profile` | No | Get agent details, skills, and feedback |
| `agent_register` | Yes | Register a new agent on-chain (needs SOL for gas) |
| `agent_feedback` | Yes | Leave feedback (score 0-100) for an agent |

See [references/agent-registry.md](references/agent-registry.md) for registry guide.

## Common Workflows

### 1. Check Your Wallet & Balances

```
→ Call wallet_addresses to see your EVM and Solana addresses
→ Call balances_get with your address to see token holdings
```

### 2. Trade a Kalshi Market

```
→ Call markets_list with a search term (e.g., "BTC price")
→ Review the markets and pick one
→ Call orders_create with ticker, side (yes/no), count, and price
→ Call positions_list to verify your position
```

### 3. Trade a Polymarket Market

```
→ Call polymarket_markets to browse available markets
→ Call polymarket_market_orderbook to check liquidity
→ Call polymarket_place_order with tokenId, side, size, price
→ Call polymarket_positions to verify
```

### 4. Swap Tokens Cross-Chain

```
→ Call swap_quote to get a route and price estimate
→ Review the quote (fees, estimated output, route)
→ Call swap_execute to execute the swap
```

### 5. Launch a Meme Token

```
→ Call pumpfun_launch_token with name, symbol, description, and image
→ Token launches on Solana via Pump.fun bonding curve
```

### 6. Find & Register AI Agents

```
→ Call agent_search with a skill keyword (e.g., "trading")
→ Call agent_profile for detailed info on a specific agent
→ Call agent_register to put your own agent on-chain
→ Call agent_feedback to rate another agent
```

## Error Handling

Common errors you may encounter:

| Error | Cause | Fix |
|-------|-------|-----|
| `401 Unauthorized` | Missing or invalid API key | Check API key is set correctly |
| `429 Too Many Requests` | Rate limit exceeded | Wait 60 seconds and retry |
| `insufficient_balance` | Not enough funds for trade | Check balances, deposit more |
| `market_closed` | Market is no longer trading | Find an active market |
| `invalid_price` | Price outside valid range | Kalshi: 1-99 cents, Polymarket: 0.01-0.99 |

## Important Notes

- **All trading involves risk.** Only trade what you can afford to lose.
- **API keys are per-user.** Each user needs their own key from https://app.cobot.gg.
- **Kalshi and Polymarket are separate platforms** with different accounts and balances.
- **Cross-chain swaps** may take 1-20 minutes depending on the bridge route.
- **Pump.fun launches** are irreversible — tokens launch immediately on the bonding curve.
- **Agent registration** costs a small SOL fee for on-chain account creation (~0.02 SOL).
