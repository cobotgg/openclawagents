# Cobot API Key Setup Guide

## Why You Need an API Key

The Cobot API key authenticates your requests to the MCP server. It connects you to your wallets, positions, and trading accounts. Without it, only read-only agent registry tools work.

## Getting Your API Key

### Step 1: Create a Cobot Account

1. Visit **https://app.cobot.gg**
2. Click **"Sign in with Google"** or create an account
3. Complete the onboarding process

### Step 2: Generate an API Key

1. Go to **Settings** → **API Keys**
2. Click **"Create API Key"**
3. Give it a descriptive name (e.g., "My OpenClaw Agent")
4. **Copy the full key immediately** — the format is `ck_<prefix>.<secret>`

**Important:** The secret portion of the key is only shown once at creation time. If you lose it, you'll need to create a new key.

### Step 3: Configure in OpenClaw

Add the MCP server to your OpenClaw configuration:

```bash
openclaw mcp add cobot \
  --url https://backend.cobot.gg/mcp \
  --header "Authorization: Bearer ck_YOUR_PREFIX.YOUR_SECRET"
```

Or manually edit `~/.openclaw/config.json`:

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

### Step 4: Verify Connection

Ask your OpenClaw agent to:
```
Check my wallet addresses
```

If the key is working, it will return your EVM and Solana wallet addresses.

## API Key Format

```
ck_abc123.xyzSecretPartHere456
│  │       │
│  │       └── Secret (shown once at creation)
│  └────────── Prefix (visible in dashboard)
└───────────── Key type identifier
```

## Security Best Practices

- **Never share your API key** publicly or in code repositories
- **Never commit API keys** to git — use environment variables
- **Rotate keys** periodically from the dashboard
- **Use separate keys** for different agents or environments
- **Revoke unused keys** from Settings → API Keys

## Rate Limits

- **60 requests per 60 seconds** per API key
- Rate limit resets on a rolling window
- If you hit the limit, wait and retry
- For higher limits, contact support at https://app.cobot.gg

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `401 Unauthorized` | Check that the full key (including `ck_` prefix) is correct |
| `403 Forbidden` | Your key may be revoked — generate a new one |
| `429 Too Many Requests` | Rate limit hit — wait 60 seconds |
| Tools not appearing | Verify MCP server URL is `https://backend.cobot.gg/mcp` |
| Connection timeout | Check your network — the MCP server uses SSE protocol |
