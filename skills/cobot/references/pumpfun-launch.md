# Pump.fun Token Launch Guide

## What is Pump.fun?

Pump.fun is a Solana-based platform for launching meme tokens with an automated bonding curve. Tokens launch instantly — no liquidity provision or DEX listing needed. The bonding curve handles pricing automatically: as more people buy, the price goes up.

## Available Tool

### `pumpfun_launch_token` — Launch a Token

Launch a new token on Pump.fun's bonding curve.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Token name (e.g., `Doge Supreme`) |
| `symbol` | string | Yes | Token ticker (e.g., `DSUP`) |
| `description` | string | Yes | Token description |
| `imageUrl` | string | No | Logo URL (HTTP or IPFS) |
| `initialBuyAmount` | number | No | SOL to spend on initial buy |

**Example:**
```
Launch a meme token:
  name: "Agent Coin"
  symbol: "AGNT"
  description: "The coin for AI agents on Solana"
  imageUrl: "https://example.com/logo.png"
  initialBuyAmount: 0.1
```

## How It Works

1. **You call `pumpfun_launch_token`** with name, symbol, and description
2. **Token is created** on Solana with Pump.fun's bonding curve
3. **Initial buy** (optional) — you buy some of your own token at launch
4. **Trading begins** — anyone can buy/sell on the bonding curve
5. **Graduation** — if market cap reaches ~$69K, token migrates to Raydium DEX

## Bonding Curve Pricing

- Price starts very low (fractions of a cent)
- Each buy increases the price
- Each sell decreases the price
- The curve is deterministic — no manipulation possible
- At graduation (~$69K market cap), liquidity is moved to Raydium

## Tips

- **Logo matters** — tokens with logos get more attention
- **Description should be catchy** — it shows up on the Pump.fun frontend
- **Initial buy** creates early momentum but also means you hold the bag if nobody else buys
- **SOL required** — you need SOL in your wallet for the launch transaction fee (~0.01 SOL) plus any initial buy amount

## Important Warnings

- **Token launches are irreversible** — once launched, the token exists permanently
- **This is NOT financial advice** — meme tokens are extremely high risk
- **Most meme tokens go to zero** — only launch tokens you're prepared to lose money on
- **Don't misrepresent tokens** — don't create tokens that impersonate other projects
