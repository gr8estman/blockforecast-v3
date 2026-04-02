import { NextResponse } from "next/server";
import { bitqueryFetch } from "@/lib/bitquery/client";

// Graduated pump.fun tokens now trading on Raydium CPMM.
// IsMutable: false + UpdateAuthority = Raydium's authority confirms the token
// completed the bonding curve and migrated. Uses dataset: realtime → EAP endpoint.
const QUERY = `
query GetSafeHighVolumeRayCpmmTokens($timestamp: DateTime!, $totalResults: Int!) {
  Solana(dataset: realtime) {
    DEXTradeByTokens(
      orderBy: {descendingByField: "total_volume"}
      limit: {count: $totalResults}
      where: {
        Instruction: {Accounts: {includes: {Address: {like: "D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"}}}}
        Transaction: {Result: {Success: true}}
        Trade: {
          Currency: {
            MintAddress: {not: "So11111111111111111111111111111111111111112"}
            Fungible: true
            IsMutable: false
            UpdateAuthority: {is: "WLHv2UAZm6z4KyaaELi5pjdbJh6RESMva1Rnn8pJVVh"}
          }
          Dex: {
            ProtocolName: {is: "raydium_cp_swap"}
            ProgramAddress: {is: "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"}
          }
          PriceInUSD: {gt: 0.000001, lt: 0.05}
        }
        Block: {Time: {since: $timestamp}}
      }
    ) {
      Trade {
        Currency { MintAddress Name Symbol }
        PriceInUSD(maximum: Block_Time)
      }
      total_volume: sum(of: Trade_Side_AmountInUSD)
      total_trades: count
    }
  }
}
`;

type RawSafe = {
  Trade: {
    Currency: { MintAddress: string; Name: string; Symbol: string };
    PriceInUSD: string | number;
  };
  total_volume: string | number;
  total_trades: string | number;
};

export async function GET() {
  try {
    const timestamp = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: RawSafe[] } }>(
      QUERY,
      { timestamp, totalResults: 50 },
      true,   // useEap — dataset: realtime requires EAP endpoint
      20000
    );

    const seenSafe = new Set<string>();
    const tokens = (data.Solana.DEXTradeByTokens || [])
      .filter((t) => {
        const mint = t.Trade.Currency.MintAddress;
        if (!mint || seenSafe.has(mint)) return false;
        seenSafe.add(mint);
        return true;
      })
      .map((t) => ({
      address:         t.Trade.Currency.MintAddress,
      name:            t.Trade.Currency.Name || t.Trade.Currency.Symbol,
      symbol:          t.Trade.Currency.Symbol,
      createdAt:       new Date().toISOString(),
      creatorAddress:  "",
      initialLiquidity: 0,
      currentPrice:    Number(t.Trade.PriceInUSD) || 0,
      priceChange5m:   0,
      priceChange1h:   0,
      volume24h:       Number(t.total_volume) || 0,
      marketCap:       0,
      holders:         0,
      trades:          Number(t.total_trades) || 0,
      rugScore:        80, // graduated = higher baseline safety
      graduated:       true,
      dex:             "raydium",
      metaUri:         "",
    }));

    return NextResponse.json({ tokens }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[safe-tokens]", err);
    return NextResponse.json({ tokens: [] });
  }
}
