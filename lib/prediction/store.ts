/**
 * In-process prediction market store.
 * Data is persisted to .markets.json in the project root so it survives
 * server restarts. Swap this for a real DB (Postgres/Redis) when ready.
 */
import { randomUUID }                    from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import path                              from "path";
import { Market, Bet, Outcome, Category } from "./types";

const DATA_FILE = path.join(process.cwd(), ".markets.json");

interface StoreData {
  markets: Record<string, Market>;
  bets:    Record<string, Bet[]>;   // keyed by marketId
}

let data: StoreData = { markets: {}, bets: {} };

function load() {
  if (existsSync(DATA_FILE)) {
    try { data = JSON.parse(readFileSync(DATA_FILE, "utf8")); }
    catch { /* start fresh */ }
  }
}

function save() {
  try { writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
  catch { /* non-fatal — data still lives in memory */ }
}

load();

// ─── Public API ───────────────────────────────────────────────────────────────

export const PLATFORM_FEE = 0.02;

export function getMarkets(): Market[] {
  return Object.values(data.markets).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getMarket(id: string): Market | undefined {
  return data.markets[id];
}

export function createMarket(input: {
  question:     string;
  description?: string;
  token?:       string;
  tokenSymbol?: string;
  creator:      string;
  endTime:      string;
  category:     Category;
}): Market {
  const id = randomUUID();
  const market: Market = {
    ...input,
    id,
    yesPool:   0,
    noPool:    0,
    totalBets: 0,
    status:    "open",
    feePct:    PLATFORM_FEE,
    createdAt: new Date().toISOString(),
  };
  data.markets[id] = market;
  data.bets[id]    = [];
  save();
  return market;
}

export function placeBet(
  marketId: string,
  bettor:   string,
  outcome:  Outcome,
  amount:   number,
): Bet {
  const market = data.markets[marketId];
  if (!market)                                throw new Error("Market not found");
  if (market.status !== "open")               throw new Error("Market is not open");
  if (new Date() > new Date(market.endTime))  throw new Error("Market betting period has ended");
  if (amount < 0.01)                          throw new Error("Minimum bet is 0.01 SOL");

  const bet: Bet = {
    id:        randomUUID(),
    marketId,
    bettor,
    outcome,
    amount,
    timestamp: new Date().toISOString(),
    claimed:   false,
  };

  if (outcome === "yes") market.yesPool += amount;
  else                   market.noPool  += amount;
  market.totalBets += 1;

  data.bets[marketId].push(bet);
  save();
  return bet;
}

export function resolveMarket(marketId: string, outcome: Outcome): Market {
  const market = data.markets[marketId];
  if (!market)                    throw new Error("Market not found");
  if (market.status !== "open")   throw new Error("Market already resolved or cancelled");

  market.status      = "resolved";
  market.outcome     = outcome;
  market.resolveTime = new Date().toISOString();

  const totalPool = market.yesPool + market.noPool;
  const winPool   = outcome === "yes" ? market.yesPool : market.noPool;
  const netPool   = totalPool * (1 - PLATFORM_FEE);

  const bets = data.bets[marketId] ?? [];
  for (const bet of bets) {
    bet.payout = bet.outcome === outcome && winPool > 0
      ? (bet.amount / winPool) * netPool
      : 0;
  }
  save();
  return market;
}

export function cancelMarket(marketId: string): Market {
  const market = data.markets[marketId];
  if (!market)                    throw new Error("Market not found");
  if (market.status !== "open")   throw new Error("Market already resolved or cancelled");

  market.status = "cancelled";
  // Full refunds — payout = original amount
  const bets = data.bets[marketId] ?? [];
  for (const bet of bets) bet.payout = bet.amount;
  save();
  return market;
}

export function getMarketBets(marketId: string): Bet[] {
  return data.bets[marketId] ?? [];
}

export function getUserBets(bettor: string): (Bet & { market: Market })[] {
  const result: (Bet & { market: Market })[] = [];
  for (const [marketId, bets] of Object.entries(data.bets)) {
    for (const bet of bets) {
      if (bet.bettor.toLowerCase() === bettor.toLowerCase()) {
        result.push({ ...bet, market: data.markets[marketId] });
      }
    }
  }
  return result.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
}
