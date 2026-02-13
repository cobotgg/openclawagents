# Polymarket Trading Guide

## What is Polymarket?

Polymarket is a decentralized prediction market on Polygon where you trade outcome shares using USDC. Markets cover crypto, politics, current events, sports, and more. Each outcome share pays $1 if the outcome is correct.

## How Polymarket Markets Work

- Shares are priced between $0.01 and $0.99
- Each outcome share pays $1.00 if correct, $0.00 if wrong
- Markets can have 2+ outcomes (binary or multi-outcome)
- Trading uses the CLOB (Central Limit Order Book) for best execution
- Settlement is on-chain on Polygon

## Available Tools

### `polymarket_markets` — Search Markets

Browse and search Polymarket markets.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search keyword |
| `active` | boolean | No | Only active markets |
| `closed` | boolean | No | Only closed markets |
| `limit` | number | No | Results per page |
| `offset` | number | No | Pagination offset |

### `polymarket_events` — Browse Events

Browse Polymarket events (groups of related markets).

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search keyword |
| `active` | boolean | No | Only active events |
| `limit` | number | No | Results per page |

### `polymarket_market_orderbook` — View Orderbook

Get the current orderbook for a specific market.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenId` | string | Yes | The outcome token ID |

**Response includes:** bids, asks, spread, midpoint price.

### `polymarket_place_order` — Place an Order

Place a buy or sell order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tokenId` | string | Yes | Outcome token ID |
| `side` | string | Yes | `BUY` or `SELL` |
| `size` | number | Yes | Amount in USDC |
| `price` | number | Yes | Price per share (0.01 - 0.99) |

**Example:**
```
Buy $50 worth of "Yes" shares at $0.65 each:
  tokenId: "71321045..."
  side: "BUY"
  size: 50
  price: 0.65
```

### `polymarket_positions` — View Positions

View your current positions across all markets.

No parameters required — returns all positions for the authenticated user.

### `polymarket_open_orders` — View Open Orders

View your currently open (unfilled) orders.

No parameters required.

### `polymarket_cancel_order` — Cancel an Order

Cancel an open order.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderId` | string | Yes | The order ID to cancel |

## Trading Workflow

### Step 1: Find a Market
```
→ Call polymarket_markets with query: "bitcoin"
→ Review the results — each market has a conditionId, outcomes, and token IDs
→ Note the tokenId for the outcome you want to trade
```

### Step 2: Check the Orderbook
```
→ Call polymarket_market_orderbook with the tokenId
→ Review bid/ask spread
→ Decide on your entry price
```

### Step 3: Place Your Trade
```
→ Call polymarket_place_order with tokenId, side, size, and price
→ Limit orders sit on the book until filled or cancelled
```

### Step 4: Monitor & Exit
```
→ Call polymarket_positions to see your current positions
→ Call polymarket_open_orders to see pending orders
→ To exit: sell your shares via polymarket_place_order with side: "SELL"
→ Or cancel unfilled orders with polymarket_cancel_order
```

## Key Differences from Kalshi

| Feature | Kalshi | Polymarket |
|---------|--------|------------|
| **Currency** | USD (regulated) | USDC on Polygon |
| **Regulation** | CFTC-regulated | Decentralized |
| **Order types** | Market + Limit | Limit only (CLOB) |
| **Identifiers** | Ticker string | Token ID (long hex) |
| **Settlement** | Cash | On-chain |

## Tips

- Always check the orderbook before placing orders — thin books can have wide spreads
- Use limit orders to avoid slippage
- Monitor your positions regularly
- Polymarket uses USDC on Polygon — ensure your wallet has USDC
