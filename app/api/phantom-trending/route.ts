import { NextResponse } from "next/server";

// Phantom Trade sources its trending pools from the same on-chain DEX data
// (Jupiter / Raydium / Orca). GeckoTerminal Solana trending pools accurately
// represent what Phantom surfaces — proven free API, no auth required.
const GECKO = "https://api.geckoterminal.com/api/v2";

interface GeckoPool {
  id: string;
  type: string;
  attributes: {
    address: string;
    pool_created_at?: string;
    base_token_price_usd?: string;
    volume_usd?: { m5?: string; h1?: string; h6?: string; h24?: string };
    price_change_percentage?: { m5?: string; h1?: string; h6?: string; h24?: string };
    market_cap_usd?: string;
    fdv_usd?: string;
    transactions?: {
      m5?:  { buys: number; sells: number };
      h1?:  { buys: number; sells: number };
      h24?: { buys: number; sells: number };
    };
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    dex?: { data?: { id: string } };
  };
}
interface GeckoIncluded {
  id: string;
  type: string;
  attributes: { symbol?: string; name?: string; address?: string };
}

export async function GET() {
  try {
    const res = await fetch(
      `${GECKO}/networks/solana/trending_pools?include=base_token,dex&page=1`,
      {
        headers: { Accept: "application/json;version=20230302" },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);

    const json = await res.json();
    const pools: GeckoPool[] = json.data ?? [];
    const included: GeckoIncluded[] = json.included ?? [];

    const tokenById = new Map<string, { symbol: string; name: string; address: string }>();
    for (const item of included) {
      if (item.type === "token") {
        tokenById.set(item.id, {
          symbol:  item.attributes.symbol  ?? "???",
          name:    item.attributes.name    ?? "",
          address: item.attributes.address ?? "",
        });
      }
    }

    const seen = new Set<string>();
    const tokens = pools
      .map((pool) => {
        const baseId = pool.relationships?.base_token?.data?.id ?? "";
        const base   = tokenById.get(baseId) ?? { symbol: "???", name: "Unknown", address: "" };
        const a      = pool.attributes;
        const dexId  = pool.relationships?.dex?.data?.id ?? "DEX";

        const buys24  = a.transactions?.h24?.buys  ?? 0;
        const sells24 = a.transactions?.h24?.sells ?? 0;
        const total24 = buys24 + sells24;

        return {
          address:          base.address || a.address,
          name:             base.name    || base.symbol,
          symbol:           base.symbol,
          createdAt:        a.pool_created_at ?? new Date().toISOString(),
          creatorAddress:   "",
          initialLiquidity: 0,
          currentPrice:     Number(a.base_token_price_usd)        || 0,
          priceChange5m:    Number(a.price_change_percentage?.m5)  || 0,
          priceChange1h:    Number(a.price_change_percentage?.h1)  || 0,
          volume24h:        Number(a.volume_usd?.h24)              || 0,
          marketCap:        Number(a.market_cap_usd) || Number(a.fdv_usd) || 0,
          holders:          0,
          trades:           total24,
          rugScore:         50,
          graduated:        true,
          dex:              dexId,
          buyPressurePct:   total24 > 0 ? Math.round((buys24 / total24) * 100) : 50,
        };
      })
      .filter((t) => {
        if (t.symbol === "???" || t.symbol === "SOL" || t.symbol === "USDC" || t.symbol === "USDT") return false;
        if (t.volume24h === 0) return false;
        if (seen.has(t.address)) return false;
        seen.add(t.address);
        return true;
      });

    return NextResponse.json({ tokens }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    });
  } catch (err) {
    console.error("[phantom-trending]", err);
    return NextResponse.json({ tokens: [] });
  }
}
