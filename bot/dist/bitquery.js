/**
 * Bitquery — used ONLY for smart money / large wallet detection.
 * All market data (price, volume, MC) comes from DexScreener.
 * All rug/holder data comes from Rugcheck.xyz.
 * Requires env: BITQUERY_API_KEY
 */
const ENDPOINT = "https://streaming.bitquery.io/graphql";
const SIDE_MINTS = [
    "So11111111111111111111111111111111111111112", // WSOL
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN", // JUP
];
async function gql(query, variables = {}) {
    const key = process.env.BITQUERY_API_KEY;
    if (!key)
        throw new Error("BITQUERY_API_KEY not set");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    try {
        const res = await fetch(ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
            body: JSON.stringify({ query, variables }),
            signal: ctrl.signal,
        });
        if (!res.ok)
            throw new Error(`Bitquery ${res.status}`);
        const json = await res.json();
        if (json.errors?.length)
            throw new Error(json.errors[0].message);
        return json.data;
    }
    finally {
        clearTimeout(timer);
    }
}
// ─── Fallback Basic Stats (used when DexScreener has no pairs yet) ───────────
// DexScreener indexes tokens within ~5 minutes of first trade.
// For very new tokens, we fall back to Bitquery DEXTradeByTokens for price/volume.
export async function fetchBasicStats(token) {
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const sideMints = SIDE_MINTS.map(m => `"${m}"`).join(", ");
    const q = `{ Solana { DEXTradeByTokens(
    where: {
      Trade: { Currency: { MintAddress: { is: "${token}" } } Side: { Currency: { MintAddress: { in: [${sideMints}] } } } }
      Transaction: { Result: { Success: true } }
      Block: { Time: { after: "${since24h}" } }
    }
    orderBy: { descending: Block_Time } limit: { count: 500 }
  ) { Trade { PriceInUSD AmountInUSD } } } }`;
    const data = await gql(q);
    const rows = data.Solana.DEXTradeByTokens;
    if (rows.length === 0)
        return null;
    const price = Number(rows[0].Trade.PriceInUSD) || 0;
    const volume24h = rows.reduce((s, r) => s + (Number(r.Trade.AmountInUSD) || 0), 0);
    return {
        price,
        volume24h,
        trades24h: rows.length,
        marketCap: price * 1_000_000_000, // pump.fun fixed supply
    };
}
// ─── Smart Money (Large Wallet Detection) ────────────────────────────────────
// Finds wallets that traded >$1K in this token in the last 24h.
// No free alternative to Bitquery for per-wallet volume tracking.
export async function fetchSmartMoney(token) {
    const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
    const sideMints = SIDE_MINTS.map(m => `"${m}"`).join(", ");
    const q = `{ Solana { DEXTradeByTokens(
    where: {
      Trade: { Currency: { MintAddress: { is: "${token}" } } Side: { Currency: { MintAddress: { in: [${sideMints}] } } } }
      Transaction: { Result: { Success: true } }
      Block: { Time: { after: "${since24h}" } }
    }
    orderBy: { descending: Block_Time } limit: { count: 500 }
  ) { Trade { Account { Owner } AmountInUSD Side { Type } } } } }`;
    const data = await gql(q);
    const wallets = new Map();
    for (const t of data.Solana.DEXTradeByTokens) {
        const owner = t.Trade.Account.Owner;
        const usd = Number(t.Trade.AmountInUSD) || 0;
        if (!wallets.has(owner))
            wallets.set(owner, { buyUsd: 0, sellUsd: 0 });
        const w = wallets.get(owner);
        if (t.Trade.Side.Type === "buy")
            w.buyUsd += usd;
        else
            w.sellUsd += usd;
    }
    return Array.from(wallets.entries())
        .map(([address, s]) => ({ address, volumeUsd: s.buyUsd + s.sellUsd }))
        .filter(w => w.volumeUsd >= 1_000)
        .sort((a, b) => b.volumeUsd - a.volumeUsd)
        .slice(0, 5)
        .map(w => ({ ...w, label: "Large Wallet" }));
}
