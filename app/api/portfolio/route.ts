import { NextRequest, NextResponse } from "next/server";
import { fetchWalletPumpTokens, fetchLatestPrice } from "@/lib/bitquery/client";
import { Position } from "@/types";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "address param required" }, { status: 400 });
  }

  try {
    const holdings = await fetchWalletPumpTokens(address);

    // Fetch current prices for all tokens in parallel
    const positions: Position[] = await Promise.all(
      holdings
        .filter((h) => h.BalanceUpdate.Balance > 0)
        .map(async (h) => {
          const mint = h.BalanceUpdate.Currency.MintAddress;
          const balance = h.BalanceUpdate.Balance;
          const symbol = h.BalanceUpdate.Currency.Symbol;
          const name = h.BalanceUpdate.Currency.Name;

          const currentPrice = await fetchLatestPrice(mint).catch(() => 0);
          const valueUsd = balance * currentPrice;

          return {
            tokenAddress: mint,
            tokenSymbol: symbol,
            tokenName: name,
            amount: balance,
            entryPrice: 0, // On-chain — entry not tracked
            currentPrice,
            pnl: 0,
            pnlPct: 0,
            valueUsd,
            isPaper: false,
          } satisfies Position;
        })
    );

    const totalValue = positions.reduce((s, p) => s + p.valueUsd, 0);

    return NextResponse.json({
      positions,
      totalValue,
      count: positions.length,
    });
  } catch (err) {
    console.error("[portfolio]", err);
    return NextResponse.json(
      { error: "Failed to fetch portfolio", positions: [] },
      { status: 500 }
    );
  }
}
