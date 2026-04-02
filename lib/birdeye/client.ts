const BIRDEYE_BASE = "https://public-api.birdeye.so";
const BIRDEYE_API_KEY = process.env.BIRDEYE_API_KEY!;

async function birdeyeFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(`${BIRDEYE_BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: {
      "X-API-KEY": BIRDEYE_API_KEY,
      "x-chain": "solana",
    },
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Birdeye ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (!json.success) throw new Error(`Birdeye error: ${JSON.stringify(json)}`);
  return json.data as T;
}

// ─── Token Overview (price, volume, marketcap, holders) ──────────────────────

export interface BirdeyeTokenOverview {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  priceChange24hPercent: number;
  priceChange1hPercent: number;
  mc: number;          // market cap
  circulatingSupply: number;
  v24h: number;        // volume 24h USD
  v24hChangePercent: number;
  liquidity: number;
  holder: number;
  trade24h: number;    // trade count 24h
  logoURI?: string;
  extensions?: {
    website?: string;
    twitter?: string;
    telegram?: string;
  };
  lastTradeUnixTime: number;
}

export async function getTokenOverview(address: string): Promise<BirdeyeTokenOverview | null> {
  try {
    return await birdeyeFetch<BirdeyeTokenOverview>("/defi/token_overview", { address });
  } catch {
    return null;
  }
}

// ─── Token Security (rug indicators) ─────────────────────────────────────────

export interface BirdeyeTokenSecurity {
  ownerAddress: string;
  creatorAddress: string;
  ownerBalance: number;
  ownerPercentage: number;
  creatorBalance: number;
  creatorPercentage: number;
  top10HolderBalance: number;
  top10HolderPercent: number;
  isMutable: boolean;
  mintAuthorityAddress: string | null;
  freezeAuthorityAddress: string | null;
  isToken2022: boolean;
  nonTransferable: boolean;
}

export async function getTokenSecurity(address: string): Promise<BirdeyeTokenSecurity | null> {
  try {
    return await birdeyeFetch<BirdeyeTokenSecurity>("/defi/token_security", { address });
  } catch {
    return null;
  }
}

// ─── OHLCV Data ───────────────────────────────────────────────────────────────

export type BirdeyeInterval = "1m" | "3m" | "5m" | "15m" | "30m" | "1H" | "2H" | "4H" | "6H" | "8H" | "12H" | "1D" | "3D" | "1W" | "1M";

export interface BirdeyeOHLCV {
  unixTime: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export async function getTokenOHLCV(
  address: string,
  interval: BirdeyeInterval = "1m",
  timeFrom?: number,
  timeTo?: number
): Promise<BirdeyeOHLCV[]> {
  try {
    const params: Record<string, string> = {
      address,
      type: interval,
    };
    if (timeFrom) params.time_from = timeFrom.toString();
    if (timeTo) params.time_to = timeTo.toString();

    const data = await birdeyeFetch<{ items: BirdeyeOHLCV[] }>("/defi/ohlcv", params);
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── New Token Listings ───────────────────────────────────────────────────────

export interface BirdeyeNewToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  price: number;
  liquidity: number;
  mc: number;
  v24h: number;
  priceChange24hPercent: number;
  holder: number;
  lastTradeUnixTime: number;
  logoURI?: string;
  mintTime?: number;
}

export async function getNewTokenListings(limit = 50): Promise<BirdeyeNewToken[]> {
  try {
    const data = await birdeyeFetch<{ items: BirdeyeNewToken[] }>("/defi/tokenlist", {
      sort_by: "mc",
      sort_type: "desc",
      offset: "0",
      limit: limit.toString(),
      min_liquidity: "500",
    });
    return data.items ?? [];
  } catch {
    return [];
  }
}

// ─── Token Price (single) ─────────────────────────────────────────────────────

export async function getTokenPrice(address: string): Promise<number> {
  try {
    const data = await birdeyeFetch<{ value: number }>("/defi/price", { address });
    return data.value ?? 0;
  } catch {
    return 0;
  }
}

// ─── Multi-price ──────────────────────────────────────────────────────────────

export async function getMultipleTokenPrices(
  addresses: string[]
): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  try {
    const data = await birdeyeFetch<Record<string, { value: number }>>(
      "/defi/multi_price",
      { list_address: addresses.join(",") }
    );
    const result: Record<string, number> = {};
    for (const [addr, info] of Object.entries(data)) {
      result[addr] = info.value ?? 0;
    }
    return result;
  } catch {
    return {};
  }
}

// ─── Token Trades (recent) ────────────────────────────────────────────────────

export interface BirdeyeTrade {
  blockUnixTime: number;
  txHash: string;
  from: { symbol: string; decimals: number; address: string; amount: number; uiAmount: number; price: number; nearestPrice: number; changeAmount: number; feeInfo?: unknown };
  to: { symbol: string; decimals: number; address: string; amount: number; uiAmount: number; price: number; nearestPrice: number; changeAmount: number };
  tokenPrice: number;
  volumeUSD: number;
  source: string;
  owner: string;
  side: "buy" | "sell";
}

export async function getTokenTrades(
  address: string,
  limit = 50
): Promise<BirdeyeTrade[]> {
  try {
    const data = await birdeyeFetch<{ items: BirdeyeTrade[] }>("/defi/txs/token", {
      address,
      offset: "0",
      limit: limit.toString(),
      tx_type: "swap",
    });
    return data.items ?? [];
  } catch {
    return [];
  }
}
