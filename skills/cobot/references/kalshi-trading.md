# Kalshi Trading Guide

## What is Kalshi?

Kalshi is a regulated event contract exchange (CFTC-regulated) where you trade on real-world outcomes — crypto prices, elections, weather, economics, sports, and more. Each contract pays $1 if the outcome happens (Yes) and $0 if it doesn't (No).

## How Kalshi Markets Work

- **Yes contracts** pay $1 if the event happens
- **No contracts** pay $1 if the event doesn't happen
- Prices range from $0.01 to $0.99 (displayed as 1¢ to 99¢)
- Your profit = payout - price paid
- Example: Buy "Yes" at 30¢ → if event happens, you get $1.00 (profit: 70¢)

## Available Tools

### `markets_list` — Search Markets

Find markets by keyword, status, or category.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | `open`, `closed`, `settled` |
| `series_ticker` | string | No | Filter by series (e.g., `KXBTC` for Bitcoin) |
| `event_ticker` | string | No | Filter by event |
| `limit` | number | No | Results per page (default: 20, max: 100) |
| `cursor` | string | No | Pagination cursor |

**Common series tickers:**
- `KXBTC` — Bitcoin price markets
- `KXETH` — Ethereum price markets
- `KXSOL` — Solana price markets

### `market_get` — Get Market Details

Get full details for a specific market.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Market ticker (e.g., `KXBTCD-25FEB14-99250`) |

**Response includes:** title, status, yes/no prices, volume, open interest, expiration time, rules.

### `events_list` — Browse Events

Browse event categories.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `status` | string | No | `open`, `closed`, `settled` |
| `series_ticker` | string | No | Filter by series |
| `limit` | number | No | Results per page |

### `orders_create` — Place an Order

Place a buy or sell order on a market.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Market ticker |
| `side` | string | Yes | `yes` or `no` |
| `type` | string | Yes | `market` or `limit` |
| `count` | number | Yes | Number of contracts |
| `price` | number | Limit only | Price in cents (1-99) |

**Examples:**
```
Buy 10 Yes contracts at 35¢ (limit order):
  ticker: "KXBTCD-25FEB14-99250"
  side: "yes"
  type: "limit"
  count: 10
  price: 35

Buy 5 No contracts at market price:
  ticker: "KXBTCD-25FEB14-99250"
  side: "no"
  type: "market"
  count: 5
```

### `orders_list` — View Orders

View your open and filled orders.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | No | Filter by market |
| `status` | string | No | `resting`, `filled`, `cancelled` |

### `positions_list` — View Positions

View your current positions and P&L.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | No | Filter by market |
| `settlement_status` | string | No | `unsettled`, `settled` |

### `position_close` — Close a Position

Close an existing position.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `ticker` | string | Yes | Market ticker |
| `count` | number | No | Contracts to close (default: all) |

## Trading Strategies

### Binary Event Trading
1. Search for markets with `markets_list`
2. Analyze the question and your confidence level
3. If you're >50% confident the event happens → buy Yes
4. If you're <50% confident → buy No (or sell Yes)
5. Set limit orders to get better prices

### 15-Minute Crypto Markets
Kalshi offers 15-minute resolution crypto price markets (BTC, ETH, SOL). These resolve every 15 minutes based on whether the price is above/below a strike.

1. Search: `markets_list` with `series_ticker: "KXBTCD"` (for BTC daily)
2. Find markets expiring in the next 15 minutes
3. Analyze current price vs. strike price
4. Trade accordingly

## Risk Management

- **Max loss** = price paid per contract × number of contracts
- **Never risk more than you can afford to lose**
- Use limit orders to control entry price
- Monitor positions with `positions_list`
- Close losing positions early with `position_close` to limit losses
