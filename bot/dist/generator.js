import Anthropic from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const APP_URL = (process.env.BLOCKFORECAST_URL ?? "").replace(/\/$/, "");
const X_HANDLE = process.env.BOT_CTA_HANDLE ?? "@blockforecasthq";
// LINK_MODE=url    → use live terminal URL in replies
// LINK_MODE=handle → tag X handle (default while site isn't deployed)
const LINK_MODE = process.env.LINK_MODE === "url" && APP_URL && !APP_URL.includes("localhost")
    ? "url"
    : "handle";
// ─── Helpers ─────────────────────────────────────────────────────────────────
function fmtUsd(n) {
    if (n >= 1_000_000)
        return `$${(n / 1_000_000).toFixed(2)}M`;
    if (n >= 1_000)
        return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
}
function fmtPct(n) { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }
function fmtPrice(p) {
    if (p === 0)
        return "$—";
    if (p < 0.000001)
        return `$${p.toExponential(2)}`;
    if (p < 0.01)
        return `$${p.toFixed(7)}`;
    return `$${p.toFixed(4)}`;
}
function ctaLine(tokenAddress) {
    if (LINK_MODE === "url" && APP_URL) {
        const path = tokenAddress ? `/terminal/${tokenAddress}` : "";
        return `BlockForecast got you — full terminal, sniper & live chart 🔍 ${APP_URL}${path}`;
    }
    // No link, no @ tag — clean until site is deployed
    return `BlockForecast got you 🔍 Full terminal, sniper & live chart — search BlockForecasthq on X`;
}
function extractText(content) {
    for (const block of content) {
        if (block.type === "text")
            return block.text.trim();
    }
    return "";
}
// ─── Token CA reply — single long post, Sonnet writes the full analysis ──────
export async function generateTokenReply(analysis) {
    const verdict = rugVerdict(analysis.rugScore);
    const cta = ctaLine(analysis.address);
    const smartStr = analysis.smartMoney.length > 0
        ? analysis.smartMoney.slice(0, 3)
            .map(w => `${w.address.slice(0, 8)}… ($${(w.volumeUsd / 1000).toFixed(1)}K volume)`)
            .join(", ")
        : "none";
    const flags = analysis.flags.filter(f => !f.toLowerCase().includes("unscanned") && !f.toLowerCase().includes("new"));
    const flagLines = flags.length > 0
        ? flags.map((f, i) => `  ${i + 1}. ${f}`).join("\n")
        : "  None";
    const gradLine = analysis.graduated
        ? `Graduated: Yes — on Raydium`
        : `Bonding Curve: ${analysis.bondingCurvePct}% to Raydium${analysis.bondingCurvePct >= 80 ? " 🔥 NEAR GRAD" : ""}`;
    const flagsInline = flags.length > 0 ? flags.slice(0, 3).join(" · ") : "None";
    const statsBlock = [
        `$${analysis.symbol} · ${analysis.name} · Age: ${analysis.tokenAge}`,
        `Price: ${fmtPrice(analysis.price)} | 1h: ${fmtPct(analysis.priceChange1h)} | 5m: ${fmtPct(analysis.priceChange5m)}`,
        `MCap: ${fmtUsd(analysis.marketCap)} | Vol: ${fmtUsd(analysis.volume24h)} | Holders: ${analysis.holders.toLocaleString()}`,
        `${gradLine} | Score: ${verdict}`,
        `Flags: ${flagsInline}`,
    ].join("\n");
    const ctx = [
        `Token: $${analysis.symbol} (${analysis.name})`,
        `Price: ${fmtPrice(analysis.price)}`,
        `1h: ${fmtPct(analysis.priceChange1h)} | 5m: ${fmtPct(analysis.priceChange5m)}`,
        `Market cap: ${fmtUsd(analysis.marketCap)} | Vol 24h: ${fmtUsd(analysis.volume24h)}`,
        `Holders: ${analysis.holders.toLocaleString()} | Trades 24h: ${analysis.trades.toLocaleString()}`,
        `Token age: ${analysis.tokenAge}`,
        `Safety score: ${verdict}`,
        `Graduated: ${analysis.graduated ? "Yes — on Raydium" : `No — ${analysis.bondingCurvePct}% to graduation`}`,
        `Risk flags: ${flags.length ? flags.join("; ") : "none"}`,
        `Smart money wallets: ${smartStr}`,
        `CTA (use exactly): ${cta}`,
    ].join("\n");
    const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-6",
        max_tokens: 600,
        system: `You are BlockForecast Bot — an on-chain Solana trading terminal AI replying on X.

Someone tagged you asking about a token. The data header is already prepended above your reply — DO NOT repeat any stats. Start directly with your read.

Write exactly 4 lines, then the CTA. One sentence per line. No blank lines between them except before CTA.

Line 1 — Momentum: Is the price action real or manufactured? Is volume organic or wash? Name the setup (graduation play, cabal, dead cat, clean breakout, rug structure).
Line 2 — Risk: What do the flags actually mean for a buyer? Be brutal and specific with numbers.
Line 3 — Wallets: What does smart money positioning signal? If none, say it bluntly in one line.
Line 4 — Entry: One concrete call — entry level, stop, or "stay away". No hedging.
Then a blank line, then the CTA exactly as given.

Setup patterns to name precisely:
— Cabal/narrative: concentrated wallets + wash vol + trending name → "narrative/cabal play, engineered structure, can 5x or zero"
— Graduation (80%+): call it a graduation play with entry logic
— Classic rug: low holders + creator concentration + no volume → say rug plainly
— Dead cat: 1h red + 5m green + fading vol → name it

Rules:
— Use the safety score label EXACTLY as given — never reword it
— Reference actual numbers from the data
— No hashtags. No "DYOR". No filler.
— Sound like someone who's traded 1000 pumps
— Output ONLY the post text, nothing else`,
        messages: [{ role: "user", content: ctx }],
    });
    const message = await stream.finalMessage();
    let post = extractText(message.content);
    // Always use our exact stats block — strip Claude's rewritten header if present
    // Find where Claude's narrative actually starts (first blank line after the header section)
    const headerEnd = post.search(/\n\n(?!\s*\d+\.|  )/);
    const narrative = headerEnd !== -1 ? post.slice(headerEnd).trimStart() : post;
    post = statsBlock + "\n\n" + narrative;
    // Deduplicate CTA — Claude sometimes writes it twice
    const ctaEscaped = cta.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const ctaMatches = post.match(new RegExp(ctaEscaped, "g"));
    if (ctaMatches && ctaMatches.length > 1) {
        post = post.replace(new RegExp(`(${ctaEscaped}\\s*)+$`), cta);
    }
    // Ensure CTA is present if Claude dropped it entirely
    if (!post.includes("BlockForecasthq")) {
        post = post.trimEnd() + `\n\n${cta}`;
    }
    return [post];
}
function rugVerdict(score) {
    if (score === 0)
        return "0/100 — RUG RISK 🚨";
    if (score <= 20)
        return `${score}/100 — RUG RISK 🚨`;
    if (score <= 40)
        return `${score}/100 — HIGH RISK 🔴`;
    if (score <= 60)
        return `${score}/100 — RISKY ⚠️`;
    if (score <= 79)
        return `${score}/100 — MODERATE 🟡`;
    return `${score}/100 — CLEAN 🟢`;
}
// ─── General crypto question reply (single tweet) ────────────────────────────
export async function generateCryptoReply(question) {
    const cta = ctaLine();
    const stream = anthropic.messages.stream({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: `You are BlockForecast Bot on X — Solana trading terminal AI.

BlockForecast: live charts, 1-click trading, sniper for new launches, rug scores,
LP drain alerts, smart money tracking, Jito MEV protection. Drop a CA — we scan it instantly.

Write a reply post (3-5 lines):
- Sharp, specific, crypto-native answer to the question
- Reference real mechanics where relevant (pump.fun graduation, LP depth, smart money flow, etc.)
- Last line: ${cta}

No hashtags. Sound like an alpha caller. Output ONLY the post text.`,
        messages: [{ role: "user", content: question }],
    });
    const message = await stream.finalMessage();
    let post = extractText(message.content);
    if (!post.includes(X_HANDLE) && !post.includes(APP_URL)) {
        post = post.trimEnd() + `\n\n${cta}`;
    }
    return [post];
}
