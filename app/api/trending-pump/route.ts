import { NextResponse } from "next/server";
import { bitqueryFetch } from "@/lib/bitquery/client";

// Combined query: trending pump.fun tokens + bonding curve graduation detection
const QUERY = `
query TrendingPump($from: DateTime) {
  Solana {
    DEXTradeByTokens(
      limit: {count: 100}
      orderBy: {descendingByField: "volume_usd"}
      where: {
        Block: {Time: {since: $from}}
        Trade: {
          Currency: {
            Native: false
            MintAddress: {not: "So11111111111111111111111111111111111111112"}
          }
          Dex: {ProtocolName: {is: "pump"}}
        }
        Transaction: {Result: {Success: true}}
      }
    ) {
      Trade {
        Market { MarketAddress }
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
    DEXPools(
      orderBy: {ascendingByField: "Pool_Base_PostAmount_maximum"}
      limit: {count: 1000}
      where: {Pool: {Dex: {ProtocolName: {is: "pump"}}}}
    ) {
      Pool {
        Market {
          BaseCurrency { MintAddress }
          MarketAddress
        }
        Base {
          PostAmount(maximum: Block_Slot, selectWhere: {gt: "206900000"})
        }
      }
    }
  }
}
`;

type RawTrade = {
  Trade: {
    Market: { MarketAddress: string };
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

type RawPool = {
  Pool: {
    Market: { BaseCurrency: { MintAddress: string }; MarketAddress: string };
    Base: { PostAmount: string | number | null };
  };
};

export async function GET() {
  try {
    const from = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // last 24h
    const data = await bitqueryFetch<{
      Solana: { DEXTradeByTokens: RawTrade[]; DEXPools: RawPool[] };
    }>(QUERY, { from }, false, 25000);

    // Build set of near-graduation mint addresses from DEXPools
    const nearGraduationMints = new Set<string>();
    for (const pool of data.Solana.DEXPools || []) {
      if (pool.Pool.Base.PostAmount != null) {
        nearGraduationMints.add(pool.Pool.Market.BaseCurrency.MintAddress);
      }
    }

    // Deduplicate by mint address — same token can appear across multiple pool records
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
        const prePrice    = Number(t.Trade.prePrice)  || 0;
        const priceChange = prePrice > 0 ? ((lastPrice - prePrice) / prePrice) * 100 : 0;
        const volume      = Number(t.volume_usd) || (Number(t.buy_usd) || 0) + (Number(t.sell_usd) || 0);
        const mint        = t.Trade.Currency.MintAddress;

        return {
          address:          mint,
          name:             t.Trade.Currency.Name || t.Trade.Currency.Symbol,
          symbol:           t.Trade.Currency.Symbol,
          createdAt:        new Date().toISOString(),
          creatorAddress:   "",
          initialLiquidity: 0,
          currentPrice:     lastPrice,
          priceChange5m:    priceChange,
          priceChange1h:    0,
          volume24h:        volume,
          marketCap:        0,
          holders:          Number(t.traders) || 0,
          trades:           Number(t.count)   || 0,
          rugScore:         50,
          graduated:        false,
          nearGraduation:   nearGraduationMints.has(mint),
          dex:              "pump.fun",
          metaUri:          t.Trade.Currency.Uri || "",
        };
      });

    return NextResponse.json({ tokens }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
    });
  } catch (err) {
    console.error("[trending-pump]", err);
    return NextResponse.json({ tokens: [] });
  }
}
