import { NextRequest, NextResponse } from "next/server";
import { fetchHistoricalOHLC } from "@/lib/bitquery/client";
import { OHLCBar } from "@/types";
import { cacheWrap } from "@/lib/cache";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const interval = parseInt(req.nextUrl.searchParams.get("interval") || "60");
  const daysAgo = parseInt(req.nextUrl.searchParams.get("days") || "1");

  const VALID_INTERVALS = [60, 180, 300, 900, 3600, 14400, 86400];
  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  try {
    const raw = await cacheWrap(`chart:${token}:${interval}:${daysAgo}`, 3 * 60_000, () => fetchHistoricalOHLC(token, daysAgo, interval));

    const bars: OHLCBar[] = raw
      .map((item) => ({
        time: new Date(item.Block.Time).getTime(),
        open:   Number(item.Price.Ohlc.Open)  || 0,
        high:   Number(item.Price.Ohlc.High)  || 0,
        low:    Number(item.Price.Ohlc.Low)   || 0,
        close:  Number(item.Price.Ohlc.Close) || 0,
        volume: Number(item.Volume.Base)       || 0,
      }))
      .filter((b) => b.time > 0 && b.close > 0)
      .sort((a, b) => a.time - b.time);

    return NextResponse.json({ bars, count: bars.length });
  } catch (err) {
    console.error("[chart]", err);
    return NextResponse.json({ error: "Failed to fetch chart data", bars: [] }, { status: 500 });
  }
}
