import { NextRequest, NextResponse } from "next/server";
import { fetchBatchTokenStats, fetchBondingCurveProgressBatch } from "@/lib/bitquery/client";
import { cacheWrap } from "@/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const { addresses } = (await req.json()) as { addresses: string[] };
    if (!Array.isArray(addresses) || addresses.length === 0) {
      return NextResponse.json({});
    }
    const batch = addresses.slice(0, 50);
    const cacheKey = `batch-stats:${[...batch].sort().join(",")}`;

    // Run both in parallel — bonding curve progress is independent
    const [stats, bcProgress] = await Promise.allSettled([
      cacheWrap(`${cacheKey}:stats`, 15_000, () => fetchBatchTokenStats(batch)),
      cacheWrap(`${cacheKey}:bc`, 15_000, () => fetchBondingCurveProgressBatch(batch)),
    ]);

    const statsVal = stats.status === "fulfilled" ? stats.value : {};
    const bcVal    = bcProgress.status === "fulfilled" ? bcProgress.value : {};

    // Merge bondingCurveProgress into stats
    for (const [mint, pct] of Object.entries(bcVal)) {
      if (statsVal[mint]) statsVal[mint].bondingCurveProgress = pct;
    }

    return NextResponse.json(statsVal);
  } catch (err) {
    console.error("[batch-stats]", err);
    return NextResponse.json({}, { status: 500 });
  }
}
