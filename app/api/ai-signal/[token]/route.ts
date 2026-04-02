import { NextRequest, NextResponse } from "next/server";
import { fetchHistoricalOHLC, fetchLatestPrice } from "@/lib/bitquery/client";
import { generateTradingSignal } from "@/lib/ai/deepseek";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const symbol = req.nextUrl.searchParams.get("symbol") || "TOKEN";
  const rugScore = parseInt(req.nextUrl.searchParams.get("rugScore") || "50");
  const holders = parseInt(req.nextUrl.searchParams.get("holders") || "0");

  if (!token || token.length < 10) {
    return NextResponse.json({ error: "Invalid token address" }, { status: 400 });
  }

  try {
    // Fetch OHLCV (1m bars, last 2 hours) + latest price via Bitquery
    const [ohlcRaw, currentPrice] = await Promise.all([
      fetchHistoricalOHLC(token, 1, 60).catch(() => []),
      fetchLatestPrice(token).catch(() => 0),
    ]);

    const ohlcv = ohlcRaw
      .map((item) => ({
        time: new Date(item.Block.Time).getTime(),
        open: item.Price.Ohlc.Open ?? 0,
        high: item.Price.Ohlc.High ?? 0,
        low: item.Price.Ohlc.Low ?? 0,
        close: item.Price.Ohlc.Close ?? 0,
        volume: item.Volume.Base ?? 0,
      }))
      .filter((b) => b.time > 0)
      .sort((a, b) => a.time - b.time);

    // Rough 5m / 1h changes from OHLCV
    const last = ohlcv[ohlcv.length - 1];
    const bar5mAgo = ohlcv[Math.max(0, ohlcv.length - 6)];
    const bar1hAgo = ohlcv[Math.max(0, ohlcv.length - 61)];
    const priceChange5m =
      bar5mAgo && bar5mAgo.close > 0
        ? (((last?.close ?? 0) - bar5mAgo.close) / bar5mAgo.close) * 100
        : 0;
    const priceChange1h =
      bar1hAgo && bar1hAgo.close > 0
        ? (((last?.close ?? 0) - bar1hAgo.close) / bar1hAgo.close) * 100
        : 0;
    const volume24h = ohlcv.slice(-1440).reduce((s, b) => s + b.volume, 0);

    const signal = await generateTradingSignal({
      symbol,
      currentPrice,
      ohlcv,
      volume24h,
      priceChange5m,
      priceChange1h,
      rugScore,
      holders,
    });

    return NextResponse.json(signal);
  } catch (err) {
    console.error("[ai-signal]", err);
    return NextResponse.json(
      { error: "AI signal generation failed", details: String(err) },
      { status: 500 }
    );
  }
}
