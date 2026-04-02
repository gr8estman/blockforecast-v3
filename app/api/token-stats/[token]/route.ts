import { NextRequest, NextResponse } from "next/server";
import { fetchTokenStats } from "@/lib/bitquery/client";
import { cacheWrap } from "@/lib/cache";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  try {
    const stats = await cacheWrap(`token-stats:${token}`, 20_000, () => fetchTokenStats(token));
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[token-stats]", err);
    return NextResponse.json(
      { latestPriceUsd: 0, priceChange5m: 0, priceChange1h: 0, volume24h: 0, tradeCount24h: 0, marketCap: 0, holderCount: 0 },
      { status: 500 }
    );
  }
}
