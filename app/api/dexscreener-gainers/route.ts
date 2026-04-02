import { NextResponse } from "next/server";

const DS = "https://api.dexscreener.com";

// Pair shape from DexScreener /latest/dex/tokens/{addresses}
interface DSPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  txns?: { m5?: TxnBucket; h1?: TxnBucket; h6?: TxnBucket; h24?: TxnBucket };
  volume?: { h24?: number; h6?: number; h1?: number; m5?: number };
  priceChange?: { h24?: number; h6?: number; h1?: number; m5?: number };
  liquidity?: { usd?: number };
  fdv?: number;
  pairCreatedAt?: number;
  info?: { imageUrl?: string };
}
interface TxnBucket { buys: number; sells: number }

export async function GET() {
  try {
    // Step 1 — get featured/trending Solana token addresses from DexScreener boosts
    const boostsRes = await fetch(`${DS}/token-boosts/top/v1`, {
      headers: { accept: "application/json" },
      next: { revalidate: 60 },
    });
    if (!boostsRes.ok) throw new Error(`DexScreener boosts ${boostsRes.status}`);

    const boosts: Array<{ chainId: string; tokenAddress: string }> = await boostsRes.json();
    const solanaAddrs = boosts
      .filter((b) => b.chainId === "solana")
      .map((b) => b.tokenAddress)
      .slice(0, 30);

    if (solanaAddrs.length === 0) return NextResponse.json({ tokens: [] });

    // Step 2 — get pair data (price, volume, priceChange) for those addresses
    const pairsRes = await fetch(
      `${DS}/latest/dex/tokens/${solanaAddrs.join(",")}`,
      { headers: { accept: "application/json" }, next: { revalidate: 30 } }
    );
    if (!pairsRes.ok) throw new Error(`DexScreener pairs ${pairsRes.status}`);

    const { pairs }: { pairs: DSPair[] } = await pairsRes.json();

    // Step 3 — deduplicate by base token address, keep highest-liquidity pair
    const tokenMap = new Map<string, DSPair>();
    for (const pair of (pairs ?? [])) {
      if (pair.chainId !== "solana") continue;
      const addr = pair.baseToken.address;
      const existing = tokenMap.get(addr);
      if (!existing || (pair.liquidity?.usd ?? 0) > (existing.liquidity?.usd ?? 0)) {
        tokenMap.set(addr, pair);
      }
    }

    const tokens = Array.from(tokenMap.values())
      .filter((p) => (p.volume?.h24 ?? 0) >= 500)
      .sort((a, b) => (b.priceChange?.h24 ?? 0) - (a.priceChange?.h24 ?? 0))
      .slice(0, 40)
      .map((p) => {
        const buys24 = p.txns?.h24?.buys ?? 0;
        const sells24 = p.txns?.h24?.sells ?? 0;
        const totalTxns = buys24 + sells24;
        return {
          address:          p.baseToken.address,
          name:             p.baseToken.name || p.baseToken.symbol,
          symbol:           p.baseToken.symbol,
          logoUri:          p.info?.imageUrl || undefined,
          createdAt:        p.pairCreatedAt ? new Date(p.pairCreatedAt).toISOString() : new Date().toISOString(),
          creatorAddress:   "",
          initialLiquidity: 0,
          currentPrice:     Number(p.priceUsd) || 0,
          priceChange5m:    Number(p.priceChange?.m5) || 0,
          priceChange1h:    Number(p.priceChange?.h1) || 0,
          volume24h:        Number(p.volume?.h24) || 0,
          marketCap:        Number(p.fdv) || 0,
          holders:          0,
          trades:           totalTxns,
          rugScore:         50,
          graduated:        true,
          dex:              p.dexId || "DEX",
          buyPressurePct:   totalTxns > 0 ? Math.round((buys24 / totalTxns) * 100) : 50,
        };
      });

    return NextResponse.json({ tokens }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    });
  } catch (err) {
    console.error("[dexscreener-gainers]", err);
    return NextResponse.json({ tokens: [] });
  }
}
