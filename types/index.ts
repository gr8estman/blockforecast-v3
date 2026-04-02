// ─── Token Types ─────────────────────────────────────────────────────────────

export interface Token {
  address: string;
  name: string;
  symbol: string;
  network: string;
  decimals?: number;
  logoURI?: string;
}

export interface NewToken {
  address: string;
  name: string;
  symbol: string;
  createdAt: string;
  creatorAddress: string;
  initialLiquidity: number;
  currentPrice: number;
  priceChange5m: number;
  priceChange1h: number;
  volume24h: number;
  marketCap: number;
  holders: number;
  trades: number;
  rugScore: number;
  graduated: boolean;              // pump.fun → Raydium migration complete
  nearGraduation?: boolean;        // bonding curve near the cap (pump.fun)
  unscanned?: boolean;             // new launch — no rug scan performed, treat as risky
  dex: string;
  pairAddress?: string;
  metaUri?: string;                // pump.fun IPFS metadata URI — contains image URL
  logoUri?: string;                // direct image URL (DexScreener / GeckoTerminal)
  buyPressurePct?: number;         // 0–100: % of volume from buys
  washScore?: number;              // 0–100 wash-trading score (higher = more wash)
  bondingCurveProgress?: number;   // 0–100 graduation progress (pump.fun)
  devWalletScore?: number;         // 0–100 dev wallet safety (higher = safer)
}

// ─── OHLCV Bar ────────────────────────────────────────────────────────────────

export interface OHLCBar {
  time: number; // unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ─── Order Book ───────────────────────────────────────────────────────────────

export interface OrderBookLevel {
  price: number;
  size: number;
  total: number;
  depth: number; // 0-1 for visualization
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: number;
  spreadPct: number;
  midPrice: number;
  lastUpdate: number;
}

// ─── Trade ────────────────────────────────────────────────────────────────────

export type TradeSide = "buy" | "sell";

export interface Trade {
  id: string;
  txHash: string;
  side: TradeSide;
  price: number;
  priceUsd: number;
  amount: number;
  amountUsd: number;
  maker: string;
  taker: string;
  timestamp: string;
  dex: string;
}

// ─── Rug Detection ────────────────────────────────────────────────────────────

export type RugRiskLevel = "safe" | "low" | "medium" | "high" | "rug";

export interface HolderEntry {
  address: string;
  balance: number;
  percentage: number;
  isCreator: boolean;
  isBondingCurve: boolean;
  label?: string;
}

export interface WashTradingResult {
  detected: boolean;
  selfTradeCount: number;
  suspiciousWallets: string[];
  washVolumePct: number;
  score: number; // 0-100 (higher = more wash)
}

export interface LiquidityDrainResult {
  riskLevel: RugRiskLevel;
  currentLiquidity: number;
  liquidityChange24h: number;
  largestRemoval: number;
  alerts: string[];
}

export interface RugCheckResult {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  overallScore: number; // 0-100 (higher = safer)
  riskLevel: RugRiskLevel;
  graduated: boolean;
  creatorHoldingPct: number;
  top10HoldersPct: number;
  holders: HolderEntry[];
  washTrading: WashTradingResult;
  liquidity: LiquidityDrainResult;
  preDistributed: boolean;
  flags: string[];
  timestamp: string;
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface Position {
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  valueUsd: number;
  isPaper: boolean;
}

export interface PortfolioSummary {
  totalValueUsd: number;
  totalPnl: number;
  totalPnlPct: number;
  positions: Position[];
  paperPositions: Position[];
}

// ─── Orders ───────────────────────────────────────────────────────────────────

export type OrderType = "market" | "limit";
export type OrderStatus = "pending" | "filled" | "cancelled";

export interface Order {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  side: TradeSide;
  type: OrderType;
  amount: number;
  price?: number;
  status: OrderStatus;
  isPaper: boolean;
  createdAt: string;
  filledAt?: string;
  txHash?: string;
}

// ─── Wallet ───────────────────────────────────────────────────────────────────

export type WalletMode = "phantom" | "generated";

export interface GeneratedWallet {
  publicKey: string;
  secretKey: string; // base58 encoded
  balance: number;
}

export interface WalletState {
  mode: WalletMode;
  isPaperTrading: boolean;
  phantomConnected: boolean;
  phantomAddress: string | null;
  generated: GeneratedWallet | null;
  activeAddress: string | null;
  solBalance: number;
}

// ─── Bitquery Responses ───────────────────────────────────────────────────────

export interface BitqueryTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
}

export interface BitqueryTradeData {
  Block: { Time: string };
  Trade: {
    Amount: number;
    AmountInUSD: number;
    Price: number;
    PriceInUSD: number;
    Side: { Type: string; Account: { Address: string } };
    Currency: { Address: string; Symbol: string; Name: string };
    Dex: { ProtocolName: string; ProtocolFamily: string };
    Buyer: string;
    Seller: string;
  };
  Transaction: { Hash: string };
}

export interface BitqueryOHLCData {
  Block: { Time: string };
  Price: { Ohlc: { Open: number; High: number; Low: number; Close: number } };
  Volume: { Base: number };
}
