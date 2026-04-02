import { NextResponse } from "next/server";
import { bitqueryFetch } from "@/lib/bitquery/client";

// All-DEX trending: Raydium, Orca, Meteora, pump.fun, Jupiter, etc.
// Uses a 6h window to surface tokens that are hot RIGHT NOW.
// Sorted by price % change to surface true movers.
const QUERY = `
query TrendingAllDex($from: DateTime) {
  Solana {
    DEXTradeByTokens(
      limit: {count: 150}
      orderBy: {descendingByField: "volume_usd"}
      where: {
        Block: {Time: {since: $from}}
        Trade: {
          Currency: {
            Native: false
            Fungible: true
            MintAddress: {
              notIn: [
                "So11111111111111111111111111111111111111112"
                "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
                "11111111111111111111111111111111"
              ]
            }
          }
          Side: {
            Currency: {
              MintAddress: {
                in: [
                  "So11111111111111111111111111111111111111112"
                  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
                ]
              }
            }
          }
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {
        Dex { ProtocolName ProtocolFamily }
        Currency { Symbol Name MintAddress Uri }
        lastPrice: Price(maximum: Block_Slot)
        prePrice: Price(minimum: Block_Slot)
      }
      count
      traders: uniq(of: Trade_Account_Owner)
      buy_usd: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: buy}}}})
      sell_usd: sum(of: Trade_Side_AmountInUSD, if: {Trade: {Side: {Type: {is: sell}}}})
      volume_usd: sum(of: Trade_Side_AmountInUSD)
    }
  }
}
`;

type RawDexTrade = {
  Trade: {
    Dex: { ProtocolName: string; ProtocolFamily: string };
    Currency: { Symbol: string; Name: string; MintAddress: string; Uri?: string };
    lastPrice: string | number;
    prePrice: string | number;
  };
  count: string | number;
  traders: string | number;
  buy_usd: string | number;
  sell_usd: string | number;
  volume_usd: string | number;
};

// Map Bitquery protocol names to readable DEX labels
function dexLabel(protocolName: string, protocolFamily: string): string {
  const p = (protocolName || "").toLowerCase();
  const f = (protocolFamily || "").toLowerCase();
  if (p.includes("raydium_cp")) return "Raydium CPMM";
  if (p.includes("raydium")) return "Raydium";
  if (p.includes("orca")) return "Orca";
  if (p.includes("meteora")) return "Meteora";
  if (p.includes("pump")) return "pump.fun";
  if (p.includes("jupiter")) return "Jupiter";
  if (f.includes("raydium")) return "Raydium";
  if (f.includes("orca")) return "Orca";
  return protocolName || "DEX";
}

export async function GET() {
  try {
    const from = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(); // last 6h
    const data = await bitqueryFetch<{
      Solana: { DEXTradeByTokens: RawDexTrade[] };
    }>(QUERY, { from }, false, 25000);

    const seen = new Set<string>();
    const tokens = (data.Solana.DEXTradeByTokens || [])
      .filter((t) => {
        const mint = t.Trade.Currency.MintAddress;
        if (!mint || seen.has(mint)) return false;
        seen.add(mint);
        return true;
      })
      .map((t) => {
        const lastPrice   = Number(t.Trade.lastPrice) || 0;
        const prePrice    = Number(t.Trade.prePrice) || 0;
        const priceChange = prePrice > 0 ? ((lastPrice - prePrice) / prePrice) * 100 : 0;
        const buyUsd      = Number(t.buy_usd) || 0;
        const sellUsd     = Number(t.sell_usd) || 0;
        const volume      = Number(t.volume_usd) || buyUsd + sellUsd;

        return {
          address:          t.Trade.Currency.MintAddress,
          name:             t.Trade.Currency.Name || t.Trade.Currency.Symbol,
          symbol:           t.Trade.Currency.Symbol,
          createdAt:        new Date().toISOString(),
          creatorAddress:   "",
          initialLiquidity: 0,
          currentPrice:     lastPrice,
          priceChange5m:    priceChange,   // 6h window, used as direction indicator
          priceChange1h:    0,
          volume24h:        volume,
          marketCap:        0,
          holders:          Number(t.traders) || 0,
          trades:           Number(t.count) || 0,
          rugScore:         50,
          graduated:        false,
          dex:              dexLabel(t.Trade.Dex.ProtocolName, t.Trade.Dex.ProtocolFamily),
          metaUri:          t.Trade.Currency.Uri || "",
          // buy/sell pressure ratio for movers
          buyPressurePct:   volume > 0 ? Math.round((buyUsd / volume) * 100) : 50,
        };
      })
      // Filter out dust — min $500 volume and at least 5 traders
      .filter((t) => t.volume24h >= 500 && t.holders >= 5);

    // Split into two sorted lists:
    // `trending` = top 30 by volume (hottest right now)
    // `movers`   = top 30 by price gain (biggest pumps)
    const byVolume = [...tokens].sort((a, b) => b.volume24h - a.volume24h).slice(0, 30);
    const byGain   = [...tokens]
      .filter((t) => t.priceChange5m > 5)  // only meaningful gains
      .sort((a, b) => b.priceChange5m - a.priceChange5m)
      .slice(0, 30);

    // Merge — byGain first (true movers), then fill with byVolume
    const merged = new Map<string, typeof tokens[number]>();
    for (const t of byGain)   merged.set(t.address, t);
    for (const t of byVolume) if (!merged.has(t.address)) merged.set(t.address, t);

    return NextResponse.json({ tokens: Array.from(merged.values()) }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    });
  } catch (err) {
    console.error("[trending-dex]", err);
    return NextResponse.json({ tokens: [] });
  }
}
