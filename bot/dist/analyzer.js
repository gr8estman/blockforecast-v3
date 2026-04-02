import { fetchSmartMoney, fetchBasicStats } from "./bitquery.js";
async function fetchDexScreenerData(address) {
    try {
        const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
            signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok)
            return null;
        const data = await res.json();
        const pairs = data.pairs ?? [];
        if (pairs.length === 0)
            return null;
        // Pick highest-volume pair (most active / most liquid)
        const pair = pairs.sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))[0];
        const txns24 = (pair.txns?.h24?.buys ?? 0) + (pair.txns?.h24?.sells ?? 0);
        return {
            name: pair.baseToken?.name ?? "Unknown",
            symbol: pair.baseToken?.symbol ?? "???",
            imageUrl: pair.info?.imageUrl,
            dexId: pair.dexId ?? "",
            price: Number(pair.priceUsd ?? 0),
            priceNative: Number(pair.priceNative ?? 0),
            priceChange5m: pair.priceChange?.m5 ?? 0,
            priceChange1h: pair.priceChange?.h1 ?? 0,
            volume24h: pair.volume?.h24 ?? 0,
            marketCap: pair.marketCap ?? pair.fdv ?? 0,
            trades24h: txns24,
            liquidityUsd: pair.liquidity?.usd ?? 0,
            liquidityQuote: pair.liquidity?.quote ?? 0,
            pairCreatedAt: pair.pairCreatedAt,
        };
    }
    catch {
        return null;
    }
}
async function fetchRugcheck(mint) {
    try {
        const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok)
            return null;
        const r = await res.json();
        const flags = [];
        let score = 100;
        // Instant zero if already rugged
        if (r.rugged) {
            return {
                score: 0, riskLevel: "rug",
                flags: ["Token has been rugged — LP drained"],
                holders: r.totalHolders ?? 0,
                name: r.tokenMeta?.name ?? "Unknown",
                symbol: r.tokenMeta?.symbol ?? "???",
                imageUrl: r.tokenMeta?.image,
            };
        }
        // Dangerous authorities
        if (r.token?.mintAuthority) {
            score -= 30;
            flags.push("Mint authority enabled — creator can print unlimited supply");
        }
        if (r.token?.freezeAuthority) {
            score -= 20;
            flags.push("Freeze authority enabled — creator can freeze wallets");
        }
        // Holder concentration
        const top1Pct = r.topHolders?.[0]?.pct ?? 0;
        const top10Pct = (r.topHolders ?? []).slice(0, 10).reduce((s, h) => s + h.pct, 0);
        if (top1Pct > 20) {
            score -= 30;
            flags.push(`Top holder controls ${top1Pct.toFixed(1)}% of supply`);
        }
        else if (top1Pct > 10) {
            score -= 15;
            flags.push(`Top holder controls ${top1Pct.toFixed(1)}% of supply`);
        }
        if (top10Pct > 80) {
            score -= 25;
            flags.push(`Top 10 wallets control ${top10Pct.toFixed(1)}% of supply`);
        }
        else if (top10Pct > 60) {
            score -= 10;
            flags.push(`Top 10 wallets control ${top10Pct.toFixed(1)}% of supply`);
        }
        // Insider / pre-distribution wallets (from topHolders.insider flag)
        const insiders = (r.topHolders ?? []).filter(h => h.insider);
        if (insiders.length > 0) {
            const insiderPct = insiders.reduce((s, h) => s + h.pct, 0);
            score -= Math.min(insiders.length * 10, 30);
            flags.push(`${insiders.length} insider wallet${insiders.length > 1 ? "s" : ""} hold ${insiderPct.toFixed(1)}% of supply`);
        }
        // Graph-based insider network detection — only meaningful for new tokens (< ~10K holders).
        // For established tokens, rugcheck flags market makers / CEX wallets as "coordinated", giving false positives.
        const totalHolders = r.totalHolders ?? 0;
        const insiderCount = r.graphInsidersDetected ?? 0;
        if (insiderCount > 0 && totalHolders < 10_000) {
            const net = r.insiderNetworks?.[0];
            const netLabel = net ? ` (network: "${net.id}", ${net.type})` : "";
            if (insiderCount >= 20) {
                score -= 30;
                flags.push(`${insiderCount} coordinated insider wallets detected${netLabel} — likely cabal/pre-distribution`);
            }
            else if (insiderCount >= 5) {
                score -= 15;
                flags.push(`${insiderCount} insider wallets detected${netLabel}`);
            }
            else {
                score -= 5;
                flags.push(`${insiderCount} insider wallets detected${netLabel}`);
            }
        }
        else if (insiderCount > 0) {
            // Established token — show as info only, no score penalty
            flags.push(`${insiderCount} wallets flagged by graph analysis (common for established tokens)`);
        }
        // LP lock check — unlocked LP is a major rug vector
        const totalLpLockedPct = (r.markets ?? []).reduce((max, m) => Math.max(max, m.lp?.lpLockedPct ?? 0), 0);
        if (totalLpLockedPct < 50 && (r.markets ?? []).length > 0) {
            score -= 10;
            flags.push(`LP ${totalLpLockedPct.toFixed(0)}% locked — liquidity can be pulled`);
        }
        // Rugcheck risk items (danger = -15, warn = -5)
        for (const risk of r.risks ?? []) {
            if (risk.level === "danger") {
                score -= 15;
                flags.push(risk.name);
            }
            else if (risk.level === "warn") {
                score -= 5;
                flags.push(risk.name);
            }
            // "info" level: flag only, no score hit
            else {
                flags.push(risk.name);
            }
        }
        score = Math.max(0, Math.min(100, Math.round(score)));
        const riskLevel = score >= 80 ? "safe" : score >= 60 ? "low" : score >= 40 ? "medium" : score >= 20 ? "high" : "rug";
        return {
            score,
            riskLevel,
            flags,
            holders: r.totalHolders ?? 0,
            name: r.tokenMeta?.name ?? "Unknown",
            symbol: r.tokenMeta?.symbol ?? "???",
            imageUrl: r.tokenMeta?.image,
        };
    }
    catch {
        return null;
    }
}
// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtAge(pairCreatedAt) {
    if (!pairCreatedAt)
        return "unknown";
    const ms = Date.now() - pairCreatedAt;
    const mins = Math.floor(ms / 60_000);
    if (mins < 60)
        return `${mins}m`;
    const hrs = Math.floor(ms / 3_600_000);
    if (hrs < 48)
        return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
}
// Detect graduation from DexScreener dexId.
// pump.fun bonding curve pairs show dexId "pump.fun".
// After graduation they migrate to "pumpswap" (pump.fun's own AMM) or "raydium".
function isGraduated(dexId) {
    return dexId !== "pump.fun" && dexId !== "";
}
// Estimate bonding curve % for non-graduated tokens.
// pump.fun targets 85 SOL to fill the curve. We derive SOL pool size from
// liquidity.quote (SOL units in pool) when available, else fall back to MC ratio.
function bondingCurvePct(dex) {
    if (isGraduated(dex.dexId))
        return 100;
    // liquidityQuote is SOL in the pool for pump.fun bonding curve pairs
    const solInPool = dex.liquidityQuote;
    if (solInPool > 0) {
        return Math.min(100, Math.round((solInPool / 85) * 100));
    }
    // Fallback: pump.fun graduation ≈ $69K MC — estimate from market cap
    if (dex.marketCap > 0) {
        return Math.min(100, Math.round((dex.marketCap / 69_000) * 100));
    }
    return 0;
}
// ─── Main orchestrator ────────────────────────────────────────────────────────
export async function analyzeToken(address) {
    // All sources fetched in parallel
    const [dex, rc, smart] = await Promise.all([
        fetchDexScreenerData(address).catch(() => null),
        fetchRugcheck(address).catch(() => null),
        fetchSmartMoney(address).catch(() => []),
    ]);
    // If DexScreener has no pairs yet (very new token), fall back to Bitquery for market data
    const basicStats = !dex
        ? await fetchBasicStats(address).catch(() => null)
        : null;
    // Need at least one source of data to return anything useful
    if (!dex && !rc && !basicStats)
        return null;
    // Name/symbol: rugcheck has on-chain metadata, DexScreener as fallback
    const name = (rc?.name && rc.name !== "Unknown") ? rc.name : (dex?.name ?? "Unknown");
    const symbol = (rc?.symbol && rc.symbol !== "???") ? rc.symbol : (dex?.symbol ?? "???");
    const imageUrl = rc?.imageUrl ?? dex?.imageUrl;
    const graduated = dex ? isGraduated(dex.dexId) : false;
    return {
        address,
        symbol,
        name,
        imageUrl,
        price: dex?.price ?? basicStats?.price ?? 0,
        priceChange5m: dex?.priceChange5m ?? 0,
        priceChange1h: dex?.priceChange1h ?? 0,
        volume24h: dex?.volume24h ?? basicStats?.volume24h ?? 0,
        marketCap: dex?.marketCap ?? basicStats?.marketCap ?? 0,
        holders: rc?.holders ?? 0,
        trades: dex?.trades24h ?? basicStats?.trades24h ?? 0,
        rugScore: rc?.score ?? 0,
        riskLevel: rc?.riskLevel ?? "unknown",
        graduated,
        bondingCurvePct: dex ? bondingCurvePct(dex) : 0,
        tokenAge: fmtAge(dex?.pairCreatedAt),
        flags: rc?.flags ?? [],
        smartMoney: smart,
    };
}
