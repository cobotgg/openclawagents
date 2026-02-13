# Token Swap & Bridge Guide

## Overview

Cobot provides cross-chain token swaps and bridges powered by the LiFi aggregator. You can swap tokens on the same chain or bridge tokens across 20+ chains in a single transaction.

## Supported Chains

Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche, Fantom, Solana, Gnosis, zkSync, Linea, Scroll, Mantle, Blast, Mode, and more.

## Available Tools

### `swap_quote` — Get a Quote

Get a swap/bridge quote with route, fees, and estimated output.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `fromChain` | string | Yes | Source chain (e.g., `ethereum`, `polygon`, `solana`, `base`) |
| `toChain` | string | Yes | Destination chain |
| `fromToken` | string | Yes | Token address or symbol (e.g., `USDC`, `ETH`, `0xa0b...`) |
| `toToken` | string | Yes | Target token address or symbol |
| `amount` | string | Yes | Amount in human-readable units (e.g., `100` for 100 USDC) |

**Example — Same-chain swap:**
```
Swap 1 ETH to USDC on Ethereum:
  fromChain: "ethereum"
  toChain: "ethereum"
  fromToken: "ETH"
  toToken: "USDC"
  amount: "1"
```

**Example — Cross-chain bridge:**
```
Bridge 500 USDC from Ethereum to Polygon:
  fromChain: "ethereum"
  toChain: "polygon"
  fromToken: "USDC"
  toToken: "USDC"
  amount: "500"
```

**Example — Cross-chain swap:**
```
Swap ETH on Ethereum for SOL on Solana:
  fromChain: "ethereum"
  toChain: "solana"
  fromToken: "ETH"
  toToken: "SOL"
  amount: "0.5"
```

**Response includes:**
- Estimated output amount
- Fee breakdown (gas, bridge, protocol fees)
- Route details (which DEXs and bridges)
- Estimated time
- Quote ID (used for execution)

### `swap_execute` — Execute a Swap

Execute a previously quoted swap/bridge.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `quoteId` | string | Yes | Quote ID from `swap_quote` |

**Important:** Always get a fresh quote before executing. Quotes have a short expiration time.

### `trending_tokens` — Trending Tokens

Get trending tokens on a specific chain.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `chain` | string | Yes | Chain name (e.g., `ethereum`, `solana`, `base`) |

### `token_search` — Search Tokens

Search for tokens by name or symbol.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Token name or symbol (e.g., `PEPE`, `Uniswap`) |

### `token_info` — Token Details

Get detailed info for a specific token.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Token contract address |
| `chain` | string | Yes | Chain name |

**Response includes:** name, symbol, decimals, price, market cap, 24h volume, price change.

## Common Workflows

### Swap Tokens on Same Chain
```
1. Call swap_quote: fromChain="ethereum", toChain="ethereum", fromToken="ETH", toToken="USDC", amount="1"
2. Review the quote (output amount, fees, route)
3. Call swap_execute with the quoteId
```

### Bridge Tokens Cross-Chain
```
1. Call swap_quote: fromChain="ethereum", toChain="polygon", fromToken="USDC", toToken="USDC", amount="500"
2. Review estimated time and fees
3. Call swap_execute with the quoteId
4. Wait for bridge completion (1-20 minutes depending on route)
```

### Discover & Buy Trending Tokens
```
1. Call trending_tokens with chain="solana"
2. Find an interesting token
3. Call token_info for detailed analysis
4. Call swap_quote to get a price for buying it
5. Call swap_execute to buy
```

## Important Notes

- **Bridge times vary:** Same-chain swaps are instant. Cross-chain bridges take 1-20 minutes.
- **Slippage:** Quotes include slippage tolerance. Large amounts may get worse prices.
- **Gas fees:** The quote includes estimated gas. Ensure your wallet has native tokens for gas (ETH on Ethereum, MATIC on Polygon, SOL on Solana, etc.).
- **Token addresses:** When possible, use token symbols (e.g., `USDC`, `ETH`). For obscure tokens, use the contract address.
- **Always quote before executing** — prices change rapidly in crypto.
