# MCP Server Integration Guide

## Overview

Cobot's MCP server exposes 27 tools over the **Model Context Protocol (MCP)** using Server-Sent Events (SSE). Any MCP-compatible AI assistant can connect to it.

## Connection Details

| Property | Value |
|----------|-------|
| **URL** | `https://backend.cobot.gg/mcp` |
| **Protocol** | MCP over SSE |
| **Auth** | `Authorization: Bearer ck_<prefix>.<secret>` |
| **Rate Limit** | 60 requests / 60 seconds per key |
| **Discovery** | `https://backend.cobot.gg/.well-known/mcp.json` |

## OpenClaw Configuration

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

## Adding Registry Tools to Your Own MCP Server

If you're building your own MCP server and want to add agent registry tools, here's a reference implementation using `@modelcontextprotocol/sdk` and `zod`:

```typescript
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const REGISTRY_API_URL = process.env.AGENT_REGISTRY_API_URL || 'https://your-registry-api.workers.dev';

export function registerAgentRegistryTools(server: McpServer): void {

  // Search agents (read-only, no auth)
  server.tool(
    'agent_search',
    'Search the Solana Agent Registry for agents by name, description, or skill.',
    {
      query: z.string().optional().describe('Search by name or description'),
      skill: z.string().optional().describe('Filter by skill (e.g. trading, defi)'),
    },
    async (args) => {
      const params = new URLSearchParams();
      if (args.query) params.set('q', args.query);
      if (args.skill) params.set('skill', args.skill);
      const res = await fetch(`${REGISTRY_API_URL}/agents?${params}`);
      const data = await res.json();
      return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
    },
  );

  // Get agent profile (read-only, no auth)
  server.tool(
    'agent_profile',
    'Get detailed profile and feedback for a registered agent.',
    {
      address: z.string().describe('Agent PDA address or owner wallet address'),
    },
    async (args) => {
      const encoded = encodeURIComponent(args.address);
      const [agentRes, feedbackRes] = await Promise.all([
        fetch(`${REGISTRY_API_URL}/agents/${encoded}`),
        fetch(`${REGISTRY_API_URL}/agents/${encoded}/feedback`).catch(() => null),
      ]);
      const agent = await agentRes.json();
      const feedback = feedbackRes ? await feedbackRes.json() : { feedback: [] };
      return {
        content: [{ type: 'text', text: JSON.stringify({ agent, feedback }, null, 2) }],
      };
    },
  );

  // Register agent (authenticated, requires web3 service)
  server.tool(
    'agent_register',
    'Register a new agent on the Solana Agent Registry. Requires SOL for gas.',
    {
      name: z.string().min(1).max(32).describe('Agent name (max 32 chars)'),
      description: z.string().max(256).optional().describe('Agent description'),
      skills: z.array(z.string()).min(1).max(10).describe('Skills (max 10)'),
      service_url: z.string().optional().describe('MCP endpoint or API URL'),
      image_uri: z.string().optional().describe('Image URL'),
      metadata_uri: z.string().optional().describe('Metadata JSON URL'),
    },
    async (args, extra) => {
      // Implementation depends on your auth + web3 service setup
      // See the Anchor program in agent-registry/program/ for on-chain interaction
      throw new Error('Implement with your web3 service and auth layer');
    },
  );

  // Give feedback (authenticated)
  server.tool(
    'agent_feedback',
    'Leave feedback for an agent. One review per wallet per agent. Score 0-100.',
    {
      agent_address: z.string().describe('Agent PDA address'),
      score: z.number().min(0).max(100).describe('Score 0-100'),
      comment_uri: z.string().optional().describe('Link to detailed review'),
    },
    async (args, extra) => {
      // Implementation depends on your auth + web3 service setup
      throw new Error('Implement with your web3 service and auth layer');
    },
  );
}
```

## All 27 Tools Reference

### Read-Only (no auth needed for registry tools)

| Tool | Category | Description |
|------|----------|-------------|
| `agent_search` | Registry | Search agents by name/skill |
| `agent_profile` | Registry | Get agent details + feedback |

### Authenticated (require API key)

| Tool | Category | Description |
|------|----------|-------------|
| `agent_register` | Registry | Register agent on-chain |
| `agent_feedback` | Registry | Leave feedback (0-100 score) |
| `markets_list` | Kalshi | Search/filter markets |
| `market_get` | Kalshi | Get market details |
| `events_list` | Kalshi | Browse events |
| `orders_create` | Kalshi | Place buy/sell orders |
| `orders_list` | Kalshi | View your orders |
| `positions_list` | Kalshi | View your positions |
| `position_close` | Kalshi | Close a position |
| `polymarket_markets` | Polymarket | Search markets |
| `polymarket_events` | Polymarket | Browse events |
| `polymarket_market_orderbook` | Polymarket | View orderbook |
| `polymarket_place_order` | Polymarket | Place orders |
| `polymarket_positions` | Polymarket | View positions |
| `polymarket_open_orders` | Polymarket | View open orders |
| `polymarket_cancel_order` | Polymarket | Cancel an order |
| `swap_quote` | DeFi | Get swap/bridge quote |
| `swap_execute` | DeFi | Execute a swap |
| `trending_tokens` | DeFi | Get trending tokens |
| `token_search` | DeFi | Search tokens |
| `token_info` | DeFi | Get token details |
| `balances_get` | Wallet | Get token balances |
| `wallet_addresses` | Wallet | Get wallet addresses |
| `tokens_by_chain` | Wallet | List supported tokens |
| `pumpfun_launch_token` | Launch | Launch meme token |
