import { NextRequest, NextResponse } from "next/server";
import { fetchSolanaDexTrades } from "@/lib/bitquery/client";
import { Trade } from "@/types";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 200);

  try {
    const raw = await fetchSolanaDexTrades(token, limit);

    // DEXTradeByTokens: Trade.Side.Type = "buy"|"sell", Trade.PriceInUSD/AmountInUSD are direct
    const trades: Trade[] = raw.map((item, i) => {
      const isBuy    = item.Trade.Side.Type === "buy";
      const priceUsd = Number(item.Trade.PriceInUSD);
      const amount   = Number(item.Trade.Amount);
      // Bitquery often returns 0 for AmountInUSD on pump.fun trades — compute from price × amount
      const amountUsd = Number(item.Trade.AmountInUSD) || (priceUsd * amount);
      return {
        id: `${item.Transaction.Signature}-${i}`,
        txHash: item.Transaction.Signature,
        side: isBuy ? "buy" : "sell",
        price:    priceUsd,
        priceUsd,
        amount,
        amountUsd,
        maker:     item.Trade.Account.Owner,
        taker:     item.Trade.Side.Currency.MintAddress,
        timestamp: item.Block.Time,
        dex: item.Trade.Dex.ProtocolName,
      };
    });

    return NextResponse.json({ trades, count: trades.length });
  } catch (err) {
    console.error("[trades]", err);
    return NextResponse.json({ error: "Failed to fetch trades", trades: [] }, { status: 500 });
  }
}
