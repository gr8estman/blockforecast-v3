import { NextRequest, NextResponse } from "next/server";
import { fetchNewPumpTokens } from "@/lib/bitquery/client";
import { NewToken } from "@/types";
import { cacheWrap } from "@/lib/cache";

function parseTokenMeta(args: Array<{ Name: string; Value: Record<string, unknown> }>) {
  const meta: Record<string, string> = {};
  for (const arg of args) {
    const val = arg.Value;
    const strVal =
      (val.string as string) ||
      (val.address as string) ||
      (val.bigInteger as string) ||
      String(val.integer ?? "");
    if (arg.Name && strVal) meta[arg.Name] = strVal;
  }
  return { name: meta.name || "Unknown", symbol: meta.symbol || "???", uri: meta.uri || "", metaUri: meta.uri || "" };
}

export async function GET(req: NextRequest) {
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") || "50"), 100);

  try {
    const instructions = await cacheWrap(`new-tokens:${limit}`, 10_000, () => fetchNewPumpTokens(limit));

    const tokens = instructions
      .map((ix) => {
        const tokenAddress = ix.Instruction.Accounts[0]?.Address ?? "";
        if (tokenAddress.length < 10) return null;
        const meta = parseTokenMeta(ix.Instruction.Program.Arguments);

        return {
          address: tokenAddress,
          name: meta.name,
          symbol: meta.symbol,
          createdAt: ix.Block.Time,
          creatorAddress: ix.Transaction.DevAddress,
          initialLiquidity: 0,
          currentPrice: 0,       // populated in terminal via live WebSocket
          priceChange5m: 0,
          priceChange1h: 0,
          volume24h: 0,
          marketCap: 0,
          holders: 0,
          trades: 0,
          rugScore: 50,          // placeholder — full check at /api/rug-check
          graduated: false,
          dex: "pump.fun",
          metaUri: meta.metaUri || undefined,
        } as NewToken;
      })
      .filter((t): t is NewToken => t !== null);

    return NextResponse.json({ tokens, count: tokens.length });
  } catch (err) {
    console.warn("[new-tokens]", err);
    return NextResponse.json({ tokens: [], count: 0 });
  }
}
