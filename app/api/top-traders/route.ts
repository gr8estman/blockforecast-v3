import { NextResponse } from "next/server";
import { bitqueryFetch } from "@/lib/bitquery/client";

const QUERY = `
query topTraders($time_1d_ago: DateTime!) {
  Solana {
    DEXTradeByTokens(
      orderBy: {descendingByField: "totalVolume"}
      limit: {count: 50}
      where: {Block: {Time: {since: $time_1d_ago}}}
    ) {
      Trade {
        Account { Owner }
      }
      totalVolume: sum(of: Trade_Side_AmountInUSD)
      totalTrades: count
      buyTrades: count(if: {Trade: {Side: {Type: {is: buy}}}})
      sellTrades: count(if: {Trade: {Side: {Type: {is: sell}}}})
      uniqueTokens: uniq(of: Trade_Currency_MintAddress)
      uniqueDEXs: uniq(of: Trade_Dex_ProtocolName)
    }
  }
}
`;

type RawTrader = {
  Trade: { Account: { Owner: string } };
  totalVolume: string | number;
  totalTrades: string | number;
  buyTrades: string | number;
  sellTrades: string | number;
  uniqueTokens: string | number;
  uniqueDEXs: string | number;
};

export async function GET() {
  try {
    const time_1d_ago = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const data = await bitqueryFetch<{ Solana: { DEXTradeByTokens: RawTrader[] } }>(
      QUERY,
      { time_1d_ago },
      false,
      20000
    );

    const traders = (data.Solana.DEXTradeByTokens || []).map((t, i) => {
      const total = Number(t.totalTrades) || 1;
      const buys  = Number(t.buyTrades)   || 0;
      return {
        rank:         i + 1,
        address:      t.Trade.Account.Owner,
        totalVolume:  Number(t.totalVolume)  || 0,
        totalTrades:  total,
        buyTrades:    buys,
        sellTrades:   Number(t.sellTrades)   || 0,
        uniqueTokens: Number(t.uniqueTokens) || 0,
        buyPct:       Math.round((buys / total) * 100),
      };
    });

    return NextResponse.json({ traders }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60" },
    });
  } catch (err) {
    console.error("[top-traders]", err);
    return NextResponse.json({ traders: [] });
  }
}
