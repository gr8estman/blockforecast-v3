import { BitqueryOHLCData } from "@/types";

const BITQUERY_ENDPOINT = "https://streaming.bitquery.io/graphql";
const BITQUERY_EAP = "https://streaming.bitquery.io/eap";
const PUMPFUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

function getToken(): string {
  const token = process.env.BITQUERY_API_KEY || process.env.NEXT_PUBLIC_BITQUERY_API_KEY;
  if (!token) throw new Error("BITQUERY_API_KEY is not configured");
  return token;
}

export async function bitqueryFetch<T = unknown>(
  query: string,
  variables: Record<string, unknown> = {},
  useEap = false,
  timeoutMs = 15000
): Promise<T> {
  const endpoint = useEap ? BITQUERY_EAP : BITQUERY_ENDPOINT;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ query, variables }),
      next: { revalidate: 0 },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Bitquery HTTP ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.errors?.length) throw new Error(json.errors[0].message);
    return json.data as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchNewPumpTokens(limit = 50) {
  const query = `query {
    Solana {
      Instructions(
        where: {
          Instruction: { Program: { Address: { is: "${PUMPFUN_PROGRAM}" } Method: { in: ["create", "create_v2"] } } }
          Transaction: { Result: { Success: true } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: ${limit} }
      ) {
        Block { Time }
        Transaction { Signature DevAddress: Signer }
        Instruction {
          Accounts { Address }
          Program { Method AccountNames
            Arguments { Name Type Value {
              ... on Solana_ABI_String_Value_Arg { string }
              ... on Solana_ABI_Address_Value_Arg { address }
              ... on Solana_ABI_BigInt_Value_Arg { bigInteger }
              ... on Solana_ABI_Integer_Value_Arg { integer }
            }}
          }
        }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { Instructions: Array<{
    Block: { Time: string };
    Transaction: { Signature: string; DevAddress: string };
    Instruction: { Accounts: Array<{ Address: string }>; Program: { Method: string; AccountNames: string[]; Arguments: Array<{ Name: string; Value: Record<string, unknown> }> } };
  }> } }>(query, {}, false, 20000);
  return data.Solana.Instructions;
}

export async function fetchTokenCreationInfo(tokenAddress: string) {
  const query = `query($token: String) {
    Solana {
      Instructions(
        where: {
          Instruction: { Program: { Address: { is: "${PUMPFUN_PROGRAM}" } Method: { in: ["create", "create_v2"] } } Accounts: { includes: { Address: { is: $token } } } }
          Transaction: { Result: { Success: true } }
        }
        limit: { count: 1 }
      ) {
        Block { Creation_time: Time }
        Instruction { Accounts { Address } Program { AccountNames Method
          Arguments { Name Value {
            ... on Solana_ABI_String_Value_Arg { string }
            ... on Solana_ABI_Address_Value_Arg { address }
            ... on Solana_ABI_BigInt_Value_Arg { bigInteger }
          }}
        }}
        Transaction { Creation_transaction: Signature DevAddress: Signer }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { Instructions: Array<{
    Block: { Creation_time: string };
    Instruction: { Accounts: Array<{ Address: string }>; Program: { AccountNames: string[]; Method: string; Arguments: Array<{ Name: string; Value: Record<string, unknown> }> } };
    Transaction: { Creation_transaction: string; DevAddress: string };
  }> } }>(query, { token: tokenAddress });
  return data.Solana.Instructions[0] ?? null;
}

export async function fetchTokenHolders(tokenAddress: string) {
  // Use realtime dataset (EAP) — new tokens may not be indexed in the default dataset yet.
  // Remove Transaction filter: BalanceUpdates doesn't support Transaction.Result in where clause.
  const query = `query MyQuery($token: String) {
    Solana(dataset: realtime) {
      BalanceUpdates(
        limit: { count: 100 }
        orderBy: { descendingByField: "BalanceUpdate_Holding_maximum" }
        where: { BalanceUpdate: { Currency: { MintAddress: { is: $token } } Account: { Token: { Owner: { notIn: [""] } } } } }
      ) {
        BalanceUpdate {
          Currency { Name MintAddress Symbol }
          Account { Token { Owner } }
          Holding: PostBalance(maximum: Block_Slot)
        }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { BalanceUpdates: Array<{
    BalanceUpdate: { Currency: { Name: string; MintAddress: string; Symbol: string }; Account: { Token: { Owner: string } }; Holding: number };
  }> } }>(query, { token: tokenAddress }, true);
  return data.Solana.BalanceUpdates.filter(h => Number(h.BalanceUpdate.Holding) > 0);
}

export async function checkTokenGraduation(tokenAddress: string): Promise<boolean> {
  const query = `query($token: String) {
    Solana {
      Instructions(
        where: { Instruction: { Accounts: { includes: { Address: { is: $token } } } Program: { Address: { is: "${PUMPFUN_PROGRAM}" } } Logs: { includes: { includes: "Migrate" } } } Transaction: { Result: { Success: true } } }
        limit: { count: 1 }
      ) { Block { Time } Transaction { Signature } }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { Instructions: Array<unknown> } }>(query, { token: tokenAddress });
  return data.Solana.Instructions.length > 0;
}

export async function fetchFirstTransfers(tokenAddress: string, bondingCurve: string) {
  const query = `query MyQuery($token: String, $bonding_curve: String) {
    Solana {
      Transfers(
        limit: { count: 1000 }
        orderBy: { ascendingByField: "Block_first_transfer" }
        where: {
          Transfer: {
            Receiver: { Token: { Owner: { not: $bonding_curve notIn: ["8psNvWTrdNTiVRNzAgsou9kETXNJm2SXZyaKuJraVRtf","AkTgH1uW6J6j6QHmFNGzZuZwwXaHQsPCpHUriED28tRj"] } } }
            Currency: { MintAddress: { is: $token } }
          }
          Transaction: { Result: { Success: true } }
        }
      ) {
        Transfer { Receiver { Token { Owner } } }
        Block { first_transfer: Time(minimum: Block_Time) }
        total_transferred_amount: sum(of: Transfer_Amount)
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { Transfers: Array<{
    Transfer: { Receiver: { Token: { Owner: string } } };
    Block: { first_transfer: string };
    total_transferred_amount: number;
  }> } }>(query, { token: tokenAddress, bonding_curve: bondingCurve });
  return data.Solana.Transfers;
}

export async function fetchFirstBuys(tokenAddress: string, buyersList: string[]) {
  const query = `query MyQuery($token: String!, $buyersList: [String!]) {
    Solana {
      DEXTradeByTokens(
        orderBy: { ascendingByField: "Block_first_buy" }
        where: { Trade: { Account: { Token: { Owner: { in: $buyersList } } } Currency: { MintAddress: { is: $token } } Side: { Type: { is: buy } } } Transaction: { Result: { Success: true } } }
      ) {
        Trade { Account { Token { Owner } } Currency { Name Symbol MintAddress } Side { Type } }
        Block { first_buy: Time(minimum: Block_Time) }
        total_bought_amount: sum(of: Trade_Amount)
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{
    Trade: { Account: { Token: { Owner: string } }; Currency: { Name: string; Symbol: string; MintAddress: string }; Side: { Type: string } };
    Block: { first_buy: string }; total_bought_amount: number;
  }> } }>(query, { token: tokenAddress, buyersList });
  return data.Solana.DEXTradeByTokens;
}

export async function fetchTradesForWashDetection(tokenAddress: string) {
  const query = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: 500 }
      ) {
        Block { Time Height: Slot }
        Trade {
          Dex { ProtocolName ProtocolFamily }
          Buy  { Account { Address } Amount AmountInUSD Currency { Symbol Name MintAddress } PriceInUSD }
          Sell { Account { Address } Amount AmountInUSD Currency { Symbol Name MintAddress } PriceInUSD }
        }
        Transaction { Signature FeePayer }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTrades: Array<{
    Block: { Time: string; Height: number };
    Trade: { Dex: { ProtocolName: string; ProtocolFamily: string }; Buy: { Account: { Address: string }; Amount: number; AmountInUSD: number; Currency: { Symbol: string; Name: string; MintAddress: string }; PriceInUSD: number }; Sell: { Account: { Address: string }; Amount: number; AmountInUSD: number; Currency: { Symbol: string; Name: string; MintAddress: string }; PriceInUSD: number } };
    Transaction: { Signature: string; FeePayer: string };
  }> } }>(query, {}, true);
  return data.Solana.DEXTrades;
}

export async function fetchPoolLiquidity(bondingCurve: string) {
  const query = `query GetLatestLiquidityForPool($bondingcurve: String) {
    Solana(dataset: realtime) {
      DEXPools(
        where: { Pool: { Market: { MarketAddress: { is: $bondingcurve } } } Transaction: { Result: { Success: true } } }
        orderBy: { descending: Block_Slot }
        limit: { count: 1 }
      ) { Pool { Quote { Liquidity: PostAmount } } }
    }
  }`;
  // Uses dataset: realtime → must hit EAP endpoint
  const data = await bitqueryFetch<{ Solana: { DEXPools: Array<{ Pool: { Quote: { Liquidity: number } } }> } }>(query, { bondingcurve: bondingCurve }, true);
  return data.Solana.DEXPools[0]?.Pool?.Quote?.Liquidity ?? 0;
}

// Solana side-currency addresses (WSOL, USDC, USDT, JUP, native SOL)
const SIDE_CURRENCIES = [
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
];

export interface DexTradeByToken {
  Block: { Time: string };
  Transaction: { Signature: string };
  Trade: {
    Dex: { ProtocolFamily: string; ProtocolName: string };
    AmountInUSD: number | string;
    PriceInUSD: number | string;
    Amount: number | string;
    Account: { Owner: string };
    Side: {
      Type: string;
      Currency: { Symbol: string; MintAddress: string; Name: string };
      AmountInUSD: number | string;
      Amount: number | string;
    };
  };
}

export async function fetchSolanaDexTrades(tokenAddress: string, limit = 50): Promise<DexTradeByToken[]> {
  // DexRabbit pattern: DEXTradeByTokens with Side.Type for clean buy/sell detection
  const timeAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const sideMints = SIDE_CURRENCIES.map((m) => `"${m}"`).join(", ");
  const query = `query LatestTrades($token: String!, $time_ago: DateTime!) {
    Solana {
      DEXTradeByTokens(
        orderBy: { descending: Block_Time }
        limit: { count: ${limit} }
        where: {
          Transaction: { Result: { Success: true } }
          Trade: {
            Currency: { MintAddress: { is: $token } }
            Side: { Currency: { MintAddress: { in: [${sideMints}] } } }
          }
          Block: { Time: { after: $time_ago } }
        }
      ) {
        Block { Time }
        Transaction { Signature }
        Trade {
          Dex { ProtocolFamily ProtocolName }
          AmountInUSD
          PriceInUSD
          Amount
          Account { Owner }
          Side {
            Type
            Currency { Symbol MintAddress Name }
            AmountInUSD
            Amount
          }
        }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: DexTradeByToken[] } }>(
    query, { token: tokenAddress, time_ago: timeAgo }
  );
  return data.Solana.DEXTradeByTokens;
}

export async function fetchTokenStats(tokenAddress: string) {
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  // Fetch 1h-ago reference price with a dedicated window query (active tokens have
  // thousands of trades in 24h so the 1000-trade batch never reaches 1h ago)
  const since1h5m = new Date(Date.now() - 65 * 60_000).toISOString();
  const since55m  = new Date(Date.now() - 55 * 60_000).toISOString();
  const since5m5s = new Date(Date.now() - 5 * 60_000 - 30_000).toISOString();
  const since4m30s= new Date(Date.now() - 4 * 60_000 - 30_000).toISOString();

  const tradesQuery = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
          Block: { Time: { since: "${since24h}" } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: 1000 }
      ) {
        Block { Time }
        Trade {
          Buy  { PriceInUSD AmountInUSD Currency { MintAddress } }
          Sell { PriceInUSD AmountInUSD Currency { MintAddress } }
        }
      }
    }
  }`;

  const price1hQuery = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
          Block: { Time: { since: "${since1h5m}", till: "${since55m}" } }
        }
        orderBy: { ascending: Block_Time }
        limit: { count: 1 }
      ) {
        Trade {
          Buy  { PriceInUSD Currency { MintAddress } }
          Sell { PriceInUSD Currency { MintAddress } }
        }
      }
    }
  }`;

  const price5mQuery = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
          Block: { Time: { since: "${since5m5s}", till: "${since4m30s}" } }
        }
        orderBy: { ascending: Block_Time }
        limit: { count: 1 }
      ) {
        Trade {
          Buy  { PriceInUSD Currency { MintAddress } }
          Sell { PriceInUSD Currency { MintAddress } }
        }
      }
    }
  }`;

  // Aggregate holder count — count distinct owners with positive balance (no row limit)
  const holderCountQuery = `query MyQuery($token: String) {
    Solana(dataset: realtime) {
      BalanceUpdates(
        where: { BalanceUpdate: { Currency: { MintAddress: { is: $token } } PostBalance: { gt: "0" } Account: { Token: { Owner: { notIn: [""] } } } } }
      ) {
        holderCount: count(distinct: BalanceUpdate_Account_Token_Owner)
      }
    }
  }`;

  // Aggregate 24h volume — no trade-count cap
  const volumeQuery = `{
    Solana(dataset: realtime) {
      DEXTradeByTokens(
        where: {
          Trade: {
            Currency: { MintAddress: { is: "${tokenAddress}" } }
            Side: { Currency: { MintAddress: { in: ["So11111111111111111111111111111111111111112","EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v","Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"] } } }
          }
          Transaction: { Result: { Success: true } }
          Block: { Time: { after: "${since24h}" } }
        }
      ) {
        volume: sum(of: Trade_AmountInUSD)
        tradeCount: count
      }
    }
  }`;

  type TradeRow = {
    Block?: { Time: string };
    Trade: {
      Buy:  { PriceInUSD: number; AmountInUSD: number; Currency: { MintAddress: string } };
      Sell: { PriceInUSD: number; AmountInUSD: number; Currency: { MintAddress: string } };
    };
  };

  const [tradesData, price1hData, price5mData, holderData, volumeData] = await Promise.all([
    bitqueryFetch<{ Solana: { DEXTrades: TradeRow[] } }>(tradesQuery, {}, true),
    bitqueryFetch<{ Solana: { DEXTrades: TradeRow[] } }>(price1hQuery, {}, true).catch(() => null),
    bitqueryFetch<{ Solana: { DEXTrades: TradeRow[] } }>(price5mQuery, {}, true).catch(() => null),
    bitqueryFetch<{ Solana: { BalanceUpdates: Array<{ holderCount: number }> } }>(holderCountQuery, { token: tokenAddress }, true).catch(() => null),
    bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{ volume: number; tradeCount: number }> } }>(volumeQuery, {}, false).catch(() => null),
  ]);

  const trades = tradesData.Solana.DEXTrades;
  let latestPrice = 0;

  for (const t of trades) {
    const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
    const price = Number(isBuy ? t.Trade.Buy.PriceInUSD : t.Trade.Sell.PriceInUSD);
    if (!latestPrice && price > 0) latestPrice = price;
  }

  // Use aggregate volume (no trade-count cap); fall back to summing the 1000-trade batch
  const aggRow = volumeData?.Solana?.DEXTradeByTokens?.[0];
  let volume24h = aggRow ? Number(aggRow.volume) || 0 : 0;
  let tradeCount24h = aggRow ? Number(aggRow.tradeCount) || 0 : trades.length;
  if (volume24h === 0) {
    for (const t of trades) {
      const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
      volume24h += Number(isBuy ? t.Trade.Buy.AmountInUSD : t.Trade.Sell.AmountInUSD) || 0;
    }
    tradeCount24h = trades.length;
  }

  // Use dedicated window queries for reference prices (accurate for active tokens)
  const get1TradePrice = (data: { Solana: { DEXTrades: TradeRow[] } } | null) => {
    if (!data?.Solana?.DEXTrades?.length) return 0;
    const t = data.Solana.DEXTrades[0];
    const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
    return Number(isBuy ? t.Trade.Buy.PriceInUSD : t.Trade.Sell.PriceInUSD) || 0;
  };

  let price1hAgo = get1TradePrice(price1hData);
  let price5mAgo = get1TradePrice(price5mData);

  // Fallback: scan recent 1000 trades for 5m reference if dedicated query returned nothing
  if (price5mAgo === 0 || price1hAgo === 0) {
    const now = Date.now();
    const cut5m = now - 5 * 60_000;
    const cut1h = now - 60 * 60_000;
    for (const t of trades) {
      if (!t.Block?.Time) continue;
      const ts = new Date(t.Block.Time).getTime();
      const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
      const price = Number(isBuy ? t.Trade.Buy.PriceInUSD : t.Trade.Sell.PriceInUSD);
      if (!price) continue;
      if (!price5mAgo && ts < cut5m) price5mAgo = price;
      if (!price1hAgo && ts < cut1h) price1hAgo = price;
    }
  }

  const pct = (a: number, b: number) => b > 0 ? ((a - b) / b) * 100 : 0;
  const SUPPLY = 1_000_000_000; // pump.fun tokens have 1B supply

  // Aggregate distinct-owner count; fall back to 0 if query failed
  const holderCount = holderData?.Solana?.BalanceUpdates?.[0]
    ? Number((holderData.Solana.BalanceUpdates[0] as { holderCount: number }).holderCount) || 0
    : 0;

  return {
    latestPriceUsd:  latestPrice,
    priceChange5m:   pct(latestPrice, price5mAgo),
    priceChange1h:   pct(latestPrice, price1hAgo),
    volume24h,
    tradeCount24h,
    marketCap:       latestPrice * SUPPLY,
    holderCount,
  };
}

export async function fetchHistoricalOHLC(tokenAddress: string, daysAgo = 1, intervalSeconds = 60): Promise<BitqueryOHLCData[]> {
  const from = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  const to   = new Date().toISOString();
  // DexRabbit pattern: Trading.Tokens with tokenID "bid:solana:{mint}" gives server-side OHLC
  const tokenID = `bid:solana:${tokenAddress}`;
  const ohlcQuery = `query TradingViewHistory($from: DateTime!, $to: DateTime!, $resolution: Int!, $tokenID: String!) {
    Trading {
      Tokens(
        orderBy: { ascending: Interval_Time_Start }
        where: {
          Interval: { Time: { Duration: { eq: $resolution }, Start: { since: $from, till: $to } } }
          Token: { Id: { is: $tokenID } }
        }
      ) {
        Interval { Time { Start } }
        Volume { Usd }
        Price { Ohlc { Open Close Low High } }
      }
    }
  }`;

  try {
    const data = await bitqueryFetch<{
      Trading: { Tokens: Array<{
        Interval: { Time: { Start: string } };
        Volume: { Usd: number | string };
        Price: { Ohlc: { Open: number | string; High: number | string; Low: number | string; Close: number | string } };
      }> };
    }>(ohlcQuery, { from, to, resolution: intervalSeconds, tokenID }, false, 20000);

    if (data.Trading.Tokens.length > 0) {
      return data.Trading.Tokens.map((t) => ({
        Block: { Time: t.Interval.Time.Start },
        Price: { Ohlc: {
          Open:  Number(t.Price.Ohlc.Open),
          High:  Number(t.Price.Ohlc.High),
          Low:   Number(t.Price.Ohlc.Low),
          Close: Number(t.Price.Ohlc.Close),
        }},
        Volume: { Base: Number(t.Volume.Usd) },
      }));
    }
  } catch (e) {
    console.warn("[OHLC] Trading.Tokens failed, falling back to raw DEXTrades:", e);
  }

  // Fallback: fetch raw trades + server-side bucket aggregation
  const since = from;
  const limit = Math.min(daysAgo * 600, 3000);
  const fallbackQuery = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
          Block: { Time: { since: "${since}" } }
        }
        orderBy: { ascending: Block_Time }
        limit: { count: ${limit} }
      ) {
        Block { Time }
        Trade {
          Buy  { Currency { MintAddress } PriceInUSD AmountInUSD }
          Sell { Currency { MintAddress } PriceInUSD AmountInUSD }
        }
      }
    }
  }`;
  const fallback = await bitqueryFetch<{ Solana: { DEXTrades: Array<{
    Block: { Time: string };
    Trade: {
      Buy:  { Currency: { MintAddress: string }; PriceInUSD: number; AmountInUSD: number };
      Sell: { Currency: { MintAddress: string }; PriceInUSD: number; AmountInUSD: number };
    };
  }> } }>(fallbackQuery, {}, true, 20000);

  const intervalMs = intervalSeconds * 1000;
  const buckets = new Map<number, { open: number; high: number; low: number; close: number; volume: number }>();

  for (const t of fallback.Solana.DEXTrades) {
    const ts = new Date(t.Block.Time).getTime();
    const bucketKey = Math.floor(ts / intervalMs) * intervalMs;
    const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
    const price  = Number(isBuy ? t.Trade.Buy.PriceInUSD  : t.Trade.Sell.PriceInUSD);
    const volume = Number(isBuy ? t.Trade.Buy.AmountInUSD : t.Trade.Sell.AmountInUSD);
    if (!price || price <= 0) continue;

    const bucket = buckets.get(bucketKey);
    if (!bucket) {
      buckets.set(bucketKey, { open: price, high: price, low: price, close: price, volume: volume || 0 });
    } else {
      if (price > bucket.high) bucket.high = price;
      if (price < bucket.low)  bucket.low  = price;
      bucket.close = price;
      bucket.volume += volume || 0;
    }
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([time, ohlc]) => ({
      Block: { Time: new Date(time).toISOString() },
      Price: { Ohlc: { Open: ohlc.open, High: ohlc.high, Low: ohlc.low, Close: ohlc.close } },
      Volume: { Base: ohlc.volume },
    }));
}

export async function fetchLatestPrice(tokenAddress: string): Promise<number> {
  const query = `{
    Solana(dataset: realtime) {
      DEXTrades(
        where: {
          any: [
            { Trade: { Buy:  { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
            { Trade: { Sell: { Currency: { MintAddress: { is: "${tokenAddress}" } } } } }
          ]
          Transaction: { Result: { Success: true } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: 1 }
      ) {
        Trade {
          Buy  { Currency { MintAddress } PriceInUSD }
          Sell { Currency { MintAddress } PriceInUSD }
        }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTrades: Array<{
    Trade: {
      Buy:  { Currency: { MintAddress: string }; PriceInUSD: number };
      Sell: { Currency: { MintAddress: string }; PriceInUSD: number };
    };
  }> } }>(query, {}, true);
  const t = data.Solana.DEXTrades[0];
  if (!t) return 0;
  const isBuy = t.Trade.Buy.Currency.MintAddress === tokenAddress;
  return Number(isBuy ? t.Trade.Buy.PriceInUSD : t.Trade.Sell.PriceInUSD) || 0;
}

export type BatchStat = {
  price: number;
  volume: number;
  trades: number;
  holders: number;          // unique trader wallets in 24h (proxy for holder count)
  marketCap: number;
  priceChange5m: number;
  priceChange1h: number;
  buyPressurePct: number;   // 0–100: % of volume from buys
  washScore: number;        // 0–100 wash-trading signal
  bondingCurveProgress: number; // 0–100 graduation progress
};

export async function fetchBatchTokenStats(addresses: string[]): Promise<Record<string, BatchStat>> {
  if (addresses.length === 0) return {};
  // Use DEXTradeByTokens on regular endpoint — faster than EAP DEXTrades for batch price/volume
  const timeAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const sideMints = SIDE_CURRENCIES.map((m) => `"${m}"`).join(", ");
  const addrs = addresses.map((a) => `"${a}"`).join(",");
  const query = `{
    Solana {
      DEXTradeByTokens(
        where: {
          Trade: {
            Currency: { MintAddress: { in: [${addrs}] } }
            Side: { Currency: { MintAddress: { in: [${sideMints}] } } }
          }
          Transaction: { Result: { Success: true } }
          Block: { Time: { after: "${timeAgo}" } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: 1500 }
      ) {
        Block { Time }
        Trade {
          Currency { MintAddress }
          PriceInUSD
          AmountInUSD
          Account { Owner }
          Side { Type }
        }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{
    Block: { Time: string };
    Trade: {
      Currency: { MintAddress: string };
      PriceInUSD: number | string;
      AmountInUSD: number | string;
      Account: { Owner: string };
      Side: { Type: string };
    };
  }> } }>(query, {}, false, 35000);

  const addrSet = new Set(addresses);
  const stats: Record<string, BatchStat> = {};
  const price5mAgo: Record<string, number> = {};
  const price1hAgo: Record<string, number> = {};
  // mint → owner → tradeCount (for wash detection)
  const walletCounts: Record<string, Record<string, number>> = {};
  const SUPPLY = 1_000_000_000;
  const cut5m = Date.now() - 5 * 60_000;
  const cut1h = Date.now() - 60 * 60_000;

  for (const t of data.Solana.DEXTradeByTokens) {
    const mint  = t.Trade.Currency.MintAddress;
    if (!addrSet.has(mint)) continue;
    const price  = Number(t.Trade.PriceInUSD);
    const volUsd = Number(t.Trade.AmountInUSD);
    const ts     = new Date(t.Block.Time).getTime();
    const isBuy  = t.Trade.Side.Type === "buy";
    const owner  = t.Trade.Account.Owner;

    if (!stats[mint]) stats[mint] = { price: 0, volume: 0, trades: 0, holders: 0, marketCap: 0, priceChange5m: 0, priceChange1h: 0, buyPressurePct: 50, washScore: 0, bondingCurveProgress: 0 };
    if (!walletCounts[mint]) walletCounts[mint] = {};

    if (!stats[mint].price && price > 0) stats[mint].price = price; // descending → first = latest
    if (ts < cut5m && !price5mAgo[mint] && price > 0) price5mAgo[mint] = price;
    if (ts < cut1h && !price1hAgo[mint] && price > 0) price1hAgo[mint] = price;

    stats[mint].volume += volUsd || 0;
    stats[mint].trades++;
    // Count-based buy/sell pressure (reliable — AmountInUSD is often 0 for new tokens)
    if (isBuy) (stats[mint] as Record<string, number>).__buyCount = ((stats[mint] as Record<string, number>).__buyCount || 0) + 1;
    else        (stats[mint] as Record<string, number>).__sellCount = ((stats[mint] as Record<string, number>).__sellCount || 0) + 1;
    // Track wallet trade counts for wash score
    walletCounts[mint][owner] = (walletCounts[mint][owner] || 0) + 1;
  }

  for (const [mint, s] of Object.entries(stats)) {
    s.marketCap = s.price * SUPPLY;
    const p5m = price5mAgo[mint];
    const p1h = price1hAgo[mint];
    s.priceChange5m = p5m > 0 ? ((s.price - p5m) / p5m) * 100 : 0;
    s.priceChange1h = p1h > 0 ? ((s.price - p1h) / p1h) * 100 : 0;

    const raw = s as Record<string, number>;
    const buyCount  = raw.__buyCount  || 0;
    const sellCount = raw.__sellCount || 0;
    const totalCount = buyCount + sellCount;
    s.buyPressurePct = totalCount > 0 ? Math.round((buyCount / totalCount) * 100) : 50;
    delete raw.__buyCount; delete raw.__sellCount;

    // Unique trader wallets = proxy for holder count (no extra API call needed)
    s.holders = Object.keys(walletCounts[mint] || {}).length;

    // Wash score: based on max single-wallet trade count in this period
    const maxWalletTrades = Math.max(0, ...Object.values(walletCounts[mint] || {}));
    s.washScore = Math.min(100, Math.max(0, (maxWalletTrades - 3) * 12));
  }
  return stats;
}

export async function fetchBondingCurveProgressBatch(addresses: string[]): Promise<Record<string, number>> {
  if (addresses.length === 0) return {};
  const addrs = addresses.map((a) => `"${a}"`).join(",");
  const query = `{
    Solana(dataset: realtime) {
      DEXPools(
        where: {
          Pool: {
            Dex: { ProtocolName: { is: "pump" } }
            Market: { BaseCurrency: { MintAddress: { in: [${addrs}] } } }
          }
          Transaction: { Result: { Success: true } }
        }
        limit: { count: ${Math.min(addresses.length * 3, 200)} }
      ) {
        Pool {
          Market { BaseCurrency { MintAddress } }
          Base { PostAmount: PostAmount(maximum: Block_Slot) }
        }
      }
    }
  }`;
  try {
    const data = await bitqueryFetch<{ Solana: { DEXPools: Array<{
      Pool: { Market: { BaseCurrency: { MintAddress: string } }; Base: { PostAmount: string | number } };
    }> } }>(query, {}, true, 20000);

    const INITIAL_CURVE_TOKENS = 793_100_000;
    const result: Record<string, number> = {};
    for (const p of data.Solana.DEXPools) {
      const mint = p.Pool.Market.BaseCurrency.MintAddress;
      const postAmt = Number(p.Pool.Base.PostAmount) || 0;
      result[mint] = Math.max(0, Math.min(100,
        ((INITIAL_CURVE_TOKENS - postAmt) / INITIAL_CURVE_TOKENS) * 100
      ));
    }
    return result;
  } catch {
    return {};
  }
}

export async function fetchDevWalletStats(devAddress: string) {
  const [createdData, recentSellsData] = await Promise.all([
    // How many tokens has this dev created?
    // Filter by dev address appearing in instruction accounts (creator is always in accounts)
    bitqueryFetch<{ Solana: { Instructions: Array<{
      Block: { Time: string };
      Instruction: { Accounts: Array<{ Address: string }> };
    }> } }>(`{
      Solana {
        Instructions(
          where: {
            Instruction: {
              Program: { Address: { is: "${PUMPFUN_PROGRAM}" } Method: { in: ["create","create_v2"] } }
              Accounts: { includes: { Address: { is: "${devAddress}" } } }
            }
            Transaction: { Result: { Success: true } }
          }
          orderBy: { descending: Block_Time }
          limit: { count: 100 }
        ) { Block { Time } Instruction { Accounts { Address } } }
      }
    }`, {}, false, 15000),

    // Dev's recent trades — filter sells client-side (Side.Type enum not filterable via is:)
    bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{
      Trade: { Currency: { MintAddress: string }; Side: { Type: string } };
    }> } }>(`{
      Solana(dataset: realtime) {
        DEXTradeByTokens(
          where: {
            Trade: {
              Account: { Owner: { is: "${devAddress}" } }
            }
            Transaction: { Result: { Success: true } }
            Block: { Time: { since_relative: { days_ago: 90 } } }
          }
          limit: { count: 200 }
        ) { Trade { Currency { MintAddress } Side { Type } } }
      }
    }`, {}, true, 15000),
  ]);

  const created = createdData.Solana.Instructions;
  // Token mint addresses created by this wallet (index 0 in accounts list)
  const createdMints = new Set(
    created.map((c) => c.Instruction.Accounts[0]?.Address).filter(Boolean)
  );
  const tokensCreated = createdMints.size;

  // Tokens where dev later sold (rug signal) — filter sells client-side
  const soldMints = new Set(
    recentSellsData.Solana.DEXTradeByTokens
      .filter((t) => t.Trade.Side.Type === "sell")
      .map((t) => t.Trade.Currency.MintAddress)
  );
  const ruggedCount = [...createdMints].filter((m) => soldMints.has(m)).length;
  const rugRatio = tokensCreated > 0 ? ruggedCount / tokensCreated : 0;

  // Wallet age from oldest created token
  const oldestCreate = created[created.length - 1]?.Block?.Time;
  let walletAge = "Unknown";
  if (oldestCreate) {
    const days = Math.floor((Date.now() - new Date(oldestCreate).getTime()) / 86_400_000);
    walletAge = days < 7 ? `${days}d` : days < 30 ? `${Math.floor(days / 7)}w` : `${Math.floor(days / 30)}mo`;
  }

  let score = 100;
  if (tokensCreated > 15) score -= 15;
  if (tokensCreated > 40) score -= 15;
  if (rugRatio > 0.3)  score -= 25;
  if (rugRatio > 0.6)  score -= 25;
  const ageMs = oldestCreate ? Date.now() - new Date(oldestCreate).getTime() : 0;
  if (ageMs < 3 * 86_400_000) score -= 25; // wallet < 3 days old
  else if (ageMs < 7 * 86_400_000) score -= 10;

  const flags: string[] = [];
  if (rugRatio > 0.5)    flags.push(`Rugged ${Math.round(rugRatio * 100)}% of past tokens`);
  if (tokensCreated > 20) flags.push(`Created ${tokensCreated} tokens (serial launcher)`);
  if (ageMs > 0 && ageMs < 3 * 86_400_000) flags.push("Brand new wallet (<3 days)");

  return { score: Math.max(0, Math.min(100, score)), tokensCreated, rugRatio, walletAge, flags };
}

export async function fetchSmartMoneyForToken(tokenAddress: string) {
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const sideMints = SIDE_CURRENCIES.map((m) => `"${m}"`).join(", ");
  const query = `{
    Solana {
      DEXTradeByTokens(
        where: {
          Trade: {
            Currency: { MintAddress: { is: "${tokenAddress}" } }
            Side: { Currency: { MintAddress: { in: [${sideMints}] } } }
          }
          Transaction: { Result: { Success: true } }
          Block: { Time: { after: "${since24h}" } }
        }
        orderBy: { descending: Block_Time }
        limit: { count: 500 }
      ) {
        Trade { Account { Owner } AmountInUSD Side { Type } }
      }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{
    Trade: { Account: { Owner: string }; AmountInUSD: string | number; Side: { Type: string } };
  }> } }>(query, {}, false, 20000);

  const wallets = new Map<string, { buyUsd: number; sellUsd: number; trades: number }>();
  for (const t of data.Solana.DEXTradeByTokens) {
    const owner = t.Trade.Account.Owner;
    const usd   = Number(t.Trade.AmountInUSD) || 0;
    const isBuy = t.Trade.Side.Type === "buy";
    if (!wallets.has(owner)) wallets.set(owner, { buyUsd: 0, sellUsd: 0, trades: 0 });
    const w = wallets.get(owner)!;
    if (isBuy) w.buyUsd += usd; else w.sellUsd += usd;
    w.trades++;
  }
  return Array.from(wallets.entries())
    .map(([address, s]) => ({ address, buyUsd: s.buyUsd, sellUsd: s.sellUsd, netUsd: s.buyUsd - s.sellUsd, tradeCount: s.trades }))
    .filter((w) => w.buyUsd > 0)
    .sort((a, b) => b.buyUsd - a.buyUsd)
    .slice(0, 5);
}

export async function fetchWalletPumpTokens(walletAddress: string) {
  const query = `query MyQuery($address: String) {
    Solana {
      BalanceUpdates(
        where: { BalanceUpdate: { Account: { Owner: { is: $address } } Currency: { UpdateAuthority: { is: "TSLvdd1pWpHVjahSpsvCXUbgwsL3JAcvokwaKt1eokM" } } } }
        orderBy: { descendingByField: "BalanceUpdate_Balance_maximum" }
      ) { BalanceUpdate { Balance: PostBalance(maximum: Block_Slot) Currency { Name Symbol MintAddress UpdateAuthority } } }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { BalanceUpdates: Array<{ BalanceUpdate: { Balance: number; Currency: { Name: string; Symbol: string; MintAddress: string; UpdateAuthority: string } } }> } }>(query, { address: walletAddress });
  return data.Solana.BalanceUpdates;
}

export async function fetchWalletTokenBalances(walletAddress: string) {
  const query = `query {
    Solana {
      BalanceUpdates(
        where: { BalanceUpdate: { Account: { Owner: { is: "${walletAddress}" } } } }
        orderBy: { descendingByField: "BalanceUpdate_Balance_maximum" }
        limit: { count: 50 }
      ) { BalanceUpdate { Currency { MintAddress Symbol Name Decimals } Balance: PostBalance(maximum: Block_Slot) } }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { BalanceUpdates: Array<{ BalanceUpdate: { Currency: { MintAddress: string; Symbol: string; Name: string; Decimals: number }; Balance: number } }> } }>(query);
  return data.Solana.BalanceUpdates;
}

export async function fetchTraderActivity(traderAddress: string) {
  const query = `query MyQuery($trader: String) {
    Solana(dataset: realtime) {
      DEXTradeByTokens(
        where: {
          Block: { Time: { since_relative: { hours_ago: 6 } } }
          Trade: { Side: { Currency: { MintAddress: { in: ["So11111111111111111111111111111111111111112","11111111111111111111111111"] } } } }
          any: [ { Trade: { Account: { Address: { is: $trader } } } } { Trade: { Account: { Token: { Owner: { is: $trader } } } } } ]
        }
      ) { count }
    }
  }`;
  const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: Array<{ count: number }> } }>(query, { trader: traderAddress });
  return data.Solana.DEXTradeByTokens[0]?.count ?? 0;
}
