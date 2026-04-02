import { NextRequest, NextResponse } from "next/server";
import { getMarket, getMarketBets }  from "@/lib/prediction/store";

// GET /api/markets/[id]
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const market = getMarket(id);
  if (!market) return NextResponse.json({ error: "Market not found" }, { status: 404 });

  const bets = getMarketBets(id);
  return NextResponse.json({ market, bets, betCount: bets.length });
}
