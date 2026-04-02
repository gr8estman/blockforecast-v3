import { createClient, Client } from "graphql-ws";
import { OHLCBar, Trade } from "@/types";

// ─── Endpoints ────────────────────────────────────────────────────────────────
const WS_TRADES_ENDPOINT = `wss://streaming.bitquery.io/graphql`;
const WS_EAP_ENDPOINT    = `wss://streaming.bitquery.io/eap`;

function buildWsUrl(endpoint: string): string {
  const token =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_BITQUERY_API_KEY
      : process.env.BITQUERY_API_KEY;
  return `${endpoint}?token=${token}`;
}

// ─── Singleton Clients ────────────────────────────────────────────────────────

let tradesClient: Client | null = null;
let eapClient: Client | null = null;

function getTradesClient(): Client {
  if (!tradesClient) {
    tradesClient = createClient({
      url: buildWsUrl(WS_TRADES_ENDPOINT),
      retryAttempts: 5,
      connectionAckWaitTimeout: 10000,
    });
  }
  return tradesClient;
}

function getEapClient(): Client {
  if (!eapClient) {
    eapClient = createClient({
      url: buildWsUrl(WS_EAP_ENDPOINT),
      retryAttempts: 3,
      connectionAckWaitTimeout: 10000,
    });
  }
  return eapClient;
}

export function disposeWsClients() {
  tradesClient?.dispose();
  tradesClient = null;
  eapClient?.dispose();
  eapClient = null;
}

// ─── Real-time OHLC via Trading.Tokens subscription ─────────────────────────
//
// Uses the server-side aggregated OHLC subscription — more accurate than
// bucketing individual trades client-side.  tokenID format: bid:solana:<mint>

export function subscribeToOHLC(
  tokenAddress: string,
  intervalSeconds: number,
  onBar: (bar: OHLCBar) => void,
  onError?: (err: unknown) => void
): () => void {
  const tokenID = `bid:solana:${tokenAddress}`;

  const query = `
    subscription TradingViewHistory($resolution: Int!, $tokenID: String!) {
      Trading {
        Tokens(
          where: {
            Interval: { Time: { Duration: { eq: $resolution } } }
            Token: { Id: { is: $tokenID } }
          }
        ) {
          Interval {
            Time { Start }
          }
          Volume { Usd }
          Price {
            Ohlc { Open High Low Close }
          }
        }
      }
    }
  `;

  const client = getEapClient();

  const unsub = client.subscribe(
    { query, variables: { resolution: intervalSeconds, tokenID } },
    {
      next(data) {
        const tokens = (data.data as {
          Trading?: { Tokens?: unknown[] };
        })?.Trading?.Tokens;
        if (!tokens?.length) return;

        for (const raw of tokens) {
          const t = raw as {
            Interval: { Time: { Start: string } };
            Volume: { Usd: string | number };
            Price: { Ohlc: { Open: string | number; High: string | number; Low: string | number; Close: string | number } };
          };

          const time   = new Date(t.Interval.Time.Start).getTime();
          const { Open, High, Low, Close } = t.Price.Ohlc;
          const bar: OHLCBar = {
            time,
            open:   Number(Open)  || 0,
            high:   Number(High)  || 0,
            low:    Number(Low)   || 0,
            close:  Number(Close) || 0,
            volume: Number(t.Volume.Usd) || 0,
          };

          if (bar.open > 0 || bar.close > 0) onBar(bar);
        }
      },
      error(err) {
        console.error("[subscribeToOHLC] Error:", err);
        onError?.(err);
      },
      complete() {
        console.log("[subscribeToOHLC] Subscription complete");
      },
    }
  );

  return unsub;
}

// ─── Real-time Trades Subscription ───────────────────────────────────────────

const SIDE_CURRENCIES = [
  "11111111111111111111111111111111",
  "So11111111111111111111111111111111111111112",
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
];

export function subscribeToTrades(
  tokenAddress: string,
  onTrade: (trade: Trade) => void,
  onError?: (err: unknown) => void
): () => void {
  const sideMints = SIDE_CURRENCIES.map((m) => `"${m}"`).join(", ");

  const query = `
    subscription LatestTrades($token: String!) {
      Solana {
        DEXTradeByTokens(
          where: {
            Transaction: { Result: { Success: true } }
            Trade: {
              Currency: { MintAddress: { is: $token } }
              Side: { Currency: { MintAddress: { in: [${sideMints}] } } }
            }
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
    }
  `;

  const client = getTradesClient();

  const unsub = client.subscribe(
    { query, variables: { token: tokenAddress } },
    {
      next(data) {
        const trades = (
          data.data as {
            Solana?: { DEXTradeByTokens?: unknown[] };
          }
        )?.Solana?.DEXTradeByTokens;
        if (!trades?.length) return;

        for (const raw of trades) {
          const t = raw as {
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
                Currency: {
                  Symbol: string;
                  MintAddress: string;
                  Name: string;
                };
                AmountInUSD: number | string;
                Amount: number | string;
              };
            };
          };

          const isBuy = t.Trade.Side.Type === "buy";
          const priceUsd = Number(t.Trade.PriceInUSD) || 0;
          const amount = Number(t.Trade.Amount) || 0;
          const amountUsd =
            Number(t.Trade.AmountInUSD) || priceUsd * amount;

          onTrade({
            id: `${t.Transaction.Signature}-${t.Block.Time}`,
            txHash: t.Transaction.Signature,
            side: isBuy ? "buy" : "sell",
            price: priceUsd,
            priceUsd,
            amount,
            amountUsd,
            maker: t.Trade.Account.Owner,
            taker: t.Trade.Side.Currency.MintAddress,
            timestamp: t.Block.Time,
            dex: t.Trade.Dex.ProtocolName,
          });
        }
      },
      error(err) {
        console.error("[subscribeToTrades] Error:", err);
        onError?.(err);
      },
      complete() {
        console.log("[subscribeToTrades] Subscription complete");
      },
    }
  );

  return unsub;
}

// ─── Real-time Token Price Feed ───────────────────────────────────────────────

export function subscribeToPrice(
  tokenAddress: string,
  onPrice: (priceUsd: number) => void
): () => void {
  return subscribeToTrades(tokenAddress, (trade) => {
    if (trade.priceUsd > 0) onPrice(trade.priceUsd);
  });
}

// ─── Live LP Drain Monitor (DEXPools subscription) ────────────────────────────

export interface LPEvent {
  time: string;
  baseAmount: number;  // token amount in curve
  quoteAmount: number; // SOL amount in curve (lamports)
}

export function subscribeToLPDrain(
  tokenMintAddress: string,
  onEvent: (event: LPEvent) => void,
  onError?: (err: unknown) => void
): () => void {
  // Filter by base token mint — works for all DEX types including pump.fun bonding curves
  const query = `
    subscription LPDrain($token: String!) {
      Solana {
        DEXPools(
          where: {
            Pool: { Market: { BaseCurrency: { MintAddress: { is: $token } } } }
          }
        ) {
          Block { Time }
          Pool {
            Base { PostAmount }
            Quote { PostAmount }
          }
        }
      }
    }
  `;

  const client = getEapClient();

  const unsub = client.subscribe(
    { query, variables: { token: tokenMintAddress } },
    {
      next(data) {
        const pools = (data.data as {
          Solana?: { DEXPools?: unknown[] };
        })?.Solana?.DEXPools;
        if (!pools?.length) return;

        for (const raw of pools) {
          const p = raw as {
            Block: { Time: string };
            Pool: { Base: { PostAmount: string | number }; Quote: { PostAmount: string | number } };
          };
          onEvent({
            time: p.Block.Time,
            baseAmount: Number(p.Pool.Base.PostAmount) || 0,
            quoteAmount: Number(p.Pool.Quote.PostAmount) || 0,
          });
        }
      },
      error(err) {
        console.error("[subscribeToLPDrain] Error:", err);
        onError?.(err);
      },
      complete() {
        console.log("[subscribeToLPDrain] Subscription complete");
      },
    }
  );

  return unsub;
}