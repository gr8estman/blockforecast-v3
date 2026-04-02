# BlockForecast v3

A production-ready, real-time Solana memecoin trading terminal in the style of Axiom.trade. Built for pump.fun tokens with live charts, rug detection, AI signals, portfolio management, and paper trading.

---

## Features

- **Token Discovery** — Live feed of new pump.fun launches, trending tokens by volume, and graduated Raydium CPMM tokens, organized across five tabs (New / Movers / Safe / Medium / Rug)
- **Rug Scanner** — Automated scoring (0–100) based on holder concentration, pre-distribution detection, wash-trading analysis, and liquidity drain monitoring
- **Trading Terminal** — Real-time candlestick chart (lightweight-charts v5), live trade feed, simulated order book, buy/sell forms
- **AI Signal** — DeepSeek and Gemini 2.0 Flash powered trading signals with confidence scores and reasoning
- **Portfolio** — Paper trading simulation + Phantom wallet positions with live P&L
- **Sentinel** — Manual rug check, token watchlist, webhook alerts via Make.com
- **Global Search** — Cross-chain token/pool/trader search (Solana, ETH, BSC, Base, Arbitrum, Matic, Optimism, Tron)
- **Wallet Integration** — Phantom wallet adapter + in-app keypair generation with exportable private key

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 (`@theme` in globals.css — no tailwind.config.ts) |
| Blockchain Data | Bitquery GraphQL (HTTP + WebSocket + EAP endpoint) |
| Charts | lightweight-charts v5 |
| Wallet | @solana/wallet-adapter-react + Phantom |
| State | Zustand v5 |
| AI | DeepSeek API + Google Gemini 2.0 Flash |
| React | React 19 |

---

## Project Structure

```
blockforecast-v3/
├── app/
│   ├── page.tsx                    # Home — token discovery
│   ├── layout.tsx                  # Root layout (Navbar, StatusBar, WalletProvider)
│   ├── globals.css                 # Tailwind v4 @theme variables, dark theme
│   ├── terminal/[token]/page.tsx   # Full trading terminal
│   ├── portfolio/page.tsx          # Portfolio & P&L
│   ├── rug-analysis/[token]/page.tsx
│   ├── sentinel/page.tsx           # Manual rug check + watchlist
│   └── api/
│       ├── new-tokens/             # pump.fun latest launches
│       ├── batch-stats/            # Batch price/volume enrichment
│       ├── token-stats/[token]/    # Single token full stats
│       ├── trending-pump/          # Trending pump.fun (24h volume)
│       ├── safe-tokens/            # Graduated Raydium CPMM tokens
│       ├── chart/[token]/          # OHLCV bars
│       ├── trades/[token]/         # Recent DEX trades
│       ├── rug-check/[token]/      # Rug analysis
│       ├── ai-signal/[token]/      # AI trading signal
│       ├── top-traders/            # Top wallets by volume
│       ├── portfolio/              # Wallet holdings
│       ├── search/                 # Universal cross-chain search
│       └── snipe/                  # Token sniper
│
├── components/
│   ├── discovery/
│   │   ├── TokenList.tsx           # 5-tab discovery grid with rug scanning
│   │   └── TokenCard.tsx           # Token card (price, volume, rug score)
│   ├── terminal/
│   │   ├── TradingChart.tsx        # Candlestick + volume (lightweight-charts v5)
│   │   ├── TradeHistory.tsx        # Live trade feed
│   │   ├── OrderForm.tsx           # Buy/sell forms
│   │   ├── OrderBook.tsx           # Simulated order book
│   │   ├── TokenInfo.tsx           # Token metadata
│   │   ├── TopTraders.tsx          # Top wallets widget
│   │   └── AISignalWidget.tsx      # AI signal display
│   ├── layout/
│   │   ├── Navbar.tsx
│   │   ├── GlobalSearch.tsx        # Cross-chain search bar
│   │   └── StatusBar.tsx
│   ├── portfolio/PortfolioView.tsx
│   ├── rug/RugAnalysisPanel.tsx
│   ├── wallet/
│   │   ├── WalletControls.tsx      # Phantom + generated wallet toggle
│   │   ├── WalletProvider.tsx      # Solana adapter setup
│   │   └── WalletProviderWrapper.tsx # dynamic(ssr:false) wrapper
│   └── ui/index.tsx                # Shared UI (Button, Badge, Card, Spinner, etc.)
│
├── lib/
│   ├── bitquery/
│   │   ├── client.ts               # All Bitquery GraphQL queries (server-side)
│   │   └── websocket.ts            # WebSocket subscriptions (graphql-ws)
│   ├── rug-detector/index.ts       # Rug check orchestrator
│   ├── ai/
│   │   ├── deepseek.ts             # DeepSeek trading signal
│   │   └── gemini.ts               # Gemini 2.0 Flash alternative
│   ├── wallet/
│   │   ├── generated.ts            # Keypair generation (bs58 + web3.js)
│   │   └── paper-trading.ts        # Paper trading (localStorage)
│   ├── alerts/webhook.ts           # Make.com rug alert webhook
│   ├── birdeye/client.ts           # BirdEye price API
│   ├── helius/client.ts            # Helius RPC
│   ├── trading/sniper.ts           # Sniper logic
│   └── utils.ts                    # cn(), formatPrice(), shortAddress(), etc.
│
├── store/
│   ├── walletStore.ts              # Wallet mode, balance, paper trading toggle
│   └── tradingStore.ts             # Active token, live price, OHLC bars, trades
│
├── types/index.ts                  # All TypeScript interfaces
├── next.config.ts
├── tsconfig.json
└── .env.local                      # (not committed — see .env.example)
```

---

## Getting Started

### 1. Clone and install

```bash
git clone <repo-url>
cd blockforecast-v3
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in all values in `.env.local` — see the [Environment Variables](#environment-variables) section below.

### 3. Run development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Build for production

```bash
npm run build
npm run start
```

> **Note:** TypeScript errors are suppressed during build (`ignoreBuildErrors: true`) because `tsc` OOMs on large server builds. Run `npx tsc --noEmit` separately to type-check.

---

## Environment Variables

Create `.env.local` (never commit this file — it is in `.gitignore`).

```env
# ── Bitquery ────────────────────────────────────────────────────────────────
# Get your key at https://account.bitquery.io/user/api_v2/api_keys
BITQUERY_API_KEY=your_bitquery_key_here

# Used client-side for WebSocket subscriptions (wss://streaming.bitquery.io/graphql)
NEXT_PUBLIC_BITQUERY_API_KEY=your_bitquery_key_here

# ── Solana RPC ───────────────────────────────────────────────────────────────
# Use Helius, QuickNode, or any Solana RPC endpoint
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com

# ── AI Providers ────────────────────────────────────────────────────────────
# DeepSeek — https://platform.deepseek.com/
DEEPSEEK_API_KEY=your_deepseek_key_here

# Google Gemini — https://aistudio.google.com/apikey
GEMINI_API_KEY=your_gemini_key_here

# ── Alerts ───────────────────────────────────────────────────────────────────
# Make.com webhook URL for rug alert notifications (optional)
MAKE_WEBHOOK_URL=https://hook.eu1.make.com/your_webhook_id
```

---

## Bitquery Setup

BlockForecast v3 uses two Bitquery endpoints:

| Endpoint | URL | Used For |
|---|---|---|
| Regular | `https://streaming.bitquery.io/graphql` | Historical queries, DEXTradeByTokens, Trading.Tokens OHLC |
| EAP (realtime) | `https://streaming.bitquery.io/eap` | `dataset: realtime` — holders, graduated tokens |
| WebSocket | `wss://streaming.bitquery.io/graphql?token=KEY` | Live price/trade streaming |

**Important Bitquery notes for developers:**
- All numeric fields from Bitquery arrive as strings — always coerce with `Number()`
- `dataset: realtime` queries **must** use the EAP endpoint
- `DEXTradeByTokens` and `DEXTrades` have different field structures (see `lib/bitquery/client.ts`)
- `Trading.Tokens` for OHLC uses `tokenID: "bid:solana:{mintAddress}"` format

---

## API Routes Reference

### Token Discovery

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/new-tokens?limit=50` | Latest pump.fun launches |
| `POST` | `/api/batch-stats` | Batch enrich up to 50 tokens with price/volume |
| `GET` | `/api/trending-pump` | Top pump.fun tokens by 24h volume |
| `GET` | `/api/safe-tokens` | Graduated tokens trading on Raydium CPMM |

### Token Data

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/token-stats/[token]` | Full stats (price, volume, holders, market cap) |
| `GET` | `/api/chart/[token]?interval=60&days=1` | OHLCV bars |
| `GET` | `/api/trades/[token]?limit=50` | Recent DEX trades |
| `GET` | `/api/top-traders` | Top wallets by 24h volume |

### Analysis

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/rug-check/[token]` | Full rug analysis (score 0–100) |
| `GET` | `/api/ai-signal/[token]` | AI trading signal (DeepSeek/Gemini) |
| `GET` | `/api/search?q=...` | Cross-chain token/pool/trader search |

### Portfolio

| Method | Route | Description |
|---|---|---|
| `GET` | `/api/portfolio?address=...` | Wallet token holdings |

---

## Token Discovery Tabs

| Tab | Data Source | Description |
|---|---|---|
| **New** | `/api/new-tokens` | Latest pump.fun launches — all tagged unscanned, shown with risk warning |
| **Movers** | `/api/safe-tokens` + `/api/trending-pump` (top 20 by volume) | Graduated Raydium tokens + highest-volume pump.fun tokens |
| **Safe** | Movers after rug scan | Rug score ≥ 70 |
| **Medium** | Movers after rug scan | Rug score 40–70 |
| **Rug** | New launches + scanned movers | Scanned movers with rug score < 40, plus all unscanned new launches |

Rug scanning runs automatically in the background when Movers are loaded — top 15 by volume are scanned first, in batches of 5.

---

## Rug Score System

Scores run from **0 (definite rug) to 100 (safest)**. The score is a composite of:

- **Holder concentration** — Top 10 holders owning >80% is a red flag
- **Pre-distribution** — Token transferred to wallets before public sale opens
- **Wash trading** — Self-trades, circular volume, suspicious wallet clusters
- **Liquidity drain** — Large or rapid LP removals detected via DEXPools
- **Graduation bonus** — Tokens that completed the bonding curve and migrated to Raydium start with a higher baseline

Risk levels: `safe` (≥70) · `medium` (40–69) · `high` (<40)

---

## Wallet Modes

**Phantom** — Connect your Phantom browser extension. Real transactions on Solana mainnet.

**Generated** — An in-app keypair is created client-side and stored in `localStorage` as a base58 secret key. Useful for demo/testing. Private key can be exported and imported into any Solana wallet.

**Paper Trading** — Toggle in the wallet panel. All trades are simulated, positions and P&L tracked in `localStorage`. No real SOL spent.

---

## Key Implementation Notes for Developers

### lightweight-charts v5

Version 5 changed the API — use `chart.addSeries(CandlestickSeries, options)` **not** `chart.addCandlestickSeries()`.

```typescript
import { createChart, CandlestickSeries } from "lightweight-charts";
const chart = createChart(container, options);
const series = chart.addSeries(CandlestickSeries, { ... });
```

### Tailwind v4

No `tailwind.config.ts`. All theme customization lives in `app/globals.css` under `@theme { ... }`.

### Wallet Provider SSR

`WalletProvider` from `@solana/wallet-adapter-react-ui` must be client-side only. It is wrapped in `dynamic({ ssr: false })` in `WalletProviderWrapper.tsx` to prevent ChunkLoadError on SSR.

### Bitquery DEXTradeByTokens vs DEXTrades

These are two different query shapes:
- **`DEXTradeByTokens`** — Used for trade feeds, price queries, trending tokens. Fields: `Trade.Currency`, `Trade.PriceInUSD`, `Trade.Side.Type`
- **`DEXTrades`** — Used for wash detection only. Fields: `Trade.Buy.*` / `Trade.Sell.*` structure

See comments at the top of each file in `lib/bitquery/` for the exact field structure.

### Zustand Store Usage

```typescript
import { useWalletStore } from "@/store/walletStore";
const { mode, isPaperTrading, getActiveAddress } = useWalletStore();
```

### `useWalletModal` vs `useWalletMultiButton`

This version of `@solana/wallet-adapter-react-ui` does **not** export `useWalletMultiButton`. Use `useWalletModal` instead.

---

## Deployment

### Vercel (recommended)

1. Import the repo into Vercel
2. Add all environment variables in the Vercel dashboard
3. Framework preset: **Next.js** (auto-detected)
4. No additional build config needed — Turbopack is handled by `next.config.ts`

### Self-hosted

```bash
npm run build
npm run start   # runs on port 3000
```

Set `PORT` env var to change the port.

---

## Scripts

```bash
npm run dev      # Development server (Turbopack, hot reload)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
npx tsc --noEmit # Type-check (separate from build)
```

---

## License

Private — all rights reserved.
