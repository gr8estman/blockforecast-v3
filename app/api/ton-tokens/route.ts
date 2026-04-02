import { NextResponse } from "next/server";

// GeckoTerminal free API — no auth required
// https://api.geckoterminal.com/api/v2/networks/ton/trending_pools
const GECKO = "https://api.geckoterminal.com/api/v2";

export async function GET() {
  try {
    const res = await fetch(
      `${GECKO}/networks/ton/trending_pools?include=base_token,dex&page=1`,
      {
        headers: { Accept: "application/json;version=20230302" },
        next: { revalidate: 30 },
      }
    );
    if (!res.ok) throw new Error(`GeckoTerminal ${res.status}`);

    const json = await res.json();
    const pools: GeckoPool[] = json.data ?? [];
    const included: GeckoIncluded[] = json.included ?? [];

    // Build token lookup from included records
    const tokenById = new Map<string, { symbol: string; name: string; address: string }>();
    for (const item of included) {
      if (item.type === "token") {
        tokenById.set(item.id, {
          symbol: item.attributes.symbol ?? "???",
          name:   item.attributes.name   ?? "",
          address: item.attributes.address ?? "",
        });
      }
    }

    const tokens = pools
      .map((pool) => {
        const baseId  = pool.relationships?.base_token?.data?.id ?? "";
        const base    = tokenById.get(baseId) ?? { symbol: "???", name: "Unknown", address: "" };
        const a       = pool.attributes;
        const dexId   = pool.relationships?.dex?.data?.id ?? "TON DEX";

        return {
          address:          base.address || a.address,
          name:             base.name || base.symbol,
          symbol:           base.symbol,
          createdAt:        a.pool_created_at ?? new Date().toISOString(),
          creatorAddress:   "",
          initialLiquidity: 0,
          currentPrice:     Number(a.base_token_price_usd)        || 0,
          priceChange5m:    Number(a.price_change_percentage?.m5)  || 0,
          priceChange1h:    Number(a.price_change_percentage?.h1)  || 0,
          volume24h:        Number(a.volume_usd?.h1)               || 0,  // 1h volume
          marketCap:        Number(a.market_cap_usd) || Number(a.fdv_usd) || 0,
          holders:          0,
          trades:           (a.transactions?.h1?.buys ?? 0) + (a.transactions?.h1?.sells ?? 0),
          rugScore:         50,
          graduated:        true,
          dex:              dexId,
        };
      })
      .filter((t) => t.symbol !== "???" && t.symbol !== "TON" && t.volume24h > 0);

    // Deduplicate by base token address — keep highest-volume pool per token
    const seen = new Map<string, typeof tokens[number]>();
    for (const t of tokens) {
      const key = t.address || t.symbol;
      const existing = seen.get(key);
      if (!existing || t.volume24h > existing.volume24h) seen.set(key, t);
    }
    const deduped = Array.from(seen.values()).sort((a, b) => b.volume24h - a.volume24h);

    return NextResponse.json({ tokens: deduped }, {
      headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=15" },
    });
  } catch (err) {
    console.error("[ton-tokens]", err);
    return NextResponse.json({ tokens: [] });
  }
}

// ─── GeckoTerminal response types ──────────────────────────────────────────
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
      h6?:  { buys: number; sells: number };
      h24?: { buys: number; sells: number };
    };
  };
  relationships?: {
    base_token?: { data?: { id: string } };
    quote_token?: { data?: { id: string } };
    dex?: { data?: { id: string } };
  };
}

interface GeckoIncluded {
  id: string;
  type: string;
  attributes: { symbol?: string; name?: string; address?: string };
}
