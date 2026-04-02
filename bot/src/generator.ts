import Anthropic from "@anthropic-ai/sdk";
import type { TokenAnalysis } from "./analyzer.js";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const APP_URL   = (process.env.BLOCKFORECAST_URL ?? "").replace(/\/$/, "");
const X_HANDLE  = process.env.BOT_CTA_HANDLE ?? "@blockforecasthq";
// LINK_MODE=url    → use live terminal URL in replies
// LINK_MODE=handle → tag X handle (default while site isn't deployed)
const LINK_MODE = process.env.LINK_MODE === "url" && APP_URL && !APP_URL.includes("localhost")
  ? "url"
  : "handle";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtPct(n: number): string { return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`; }
function fmtPrice(p: number): string {
  if (p === 0)        return "$—";
  if (p < 0.000001)   return `$${p.toExponential(2)}`;
  if (p < 0.01)       return `$${p.toFixed(7)}`;
  return `$${p.toFixed(4)}`;
}


function ctaLine(tokenAddress?: string): string {
  if (LINK_MODE === "url" && APP_URL) {
    const path = tokenAddress ? `/terminal/${tokenAddress}` : "";
    return `BlockForecast got you — full terminal, sniper & live chart 🔍 ${APP_URL}${path}`;
  }
  // No link, no @ tag — clean until site is deployed
  return `BlockForecast got you 🔍 Full terminal, sniper & live chart — search BlockForecasthq on X`;
}

function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  for (const block of content) {
    if (block.type === "text") return block.text.trim();
  }
  return "";
}

// ─── Token CA reply — single long post, Sonnet writes the full analysis ──────

export async function generateTokenReply(analysis: TokenAnalysis): Promise<string[]> {
  const verdict  = rugVerdict(analysis.rugScore);
  const cta      = ctaLine(analysis.address);

  const smartStr = analysis.smartMoney.length > 0
    ? analysis.smartMoney.slice(0, 3)
        .map(w => `${w.address.slice(0, 8)}… ($${(w.volumeUsd / 1000).toFixed(1)}K volume)`)
        .join(", ")
    : "none";

  const flags = analysis.flags.filter(
    f => !f.toLowerCase().includes("unscanned") && !f.toLowerCase().includes("new")
  );

  const flagLines = flags.length > 0
    ? flags.map((f, i) => `  ${i + 1}. ${f}`).join("\n")
    : "  None";

  const gradLine = analysis.graduated
    ? `Graduated: Yes — on Raydium`
    : `Bonding Curve: ${analysis.bondingCurvePct}% to Raydium${analysis.bondingCurvePct >= 80 ? " 🔥 NEAR GRAD" : ""}`;

  const statsBlock = [
    `$${analysis.symbol} (${analysis.name})`,
    `Age: ${analysis.tokenAge}`,
    `Price: ${fmtPrice(analysis.price)}`,
    `1h: ${fmtPct(analysis.priceChange1h)} | 5m: ${fmtPct(analysis.priceChange5m)}`,
    `Mkt Cap: ${fmtUsd(analysis.marketCap)} | Vol 24h: ${fmtUsd(analysis.volume24h)}`,
    `Holders: ${analysis.holders.toLocaleString()} | Trades 24h: ${analysis.trades.toLocaleString()}`,
    gradLine,
    `Safety Score: ${verdict}`,
    `Flags:\n${flagLines}`,
    `Large Wallets ($1K+): ${analysis.smartMoney.length === 0 ? "none" : analysis.smartMoney.length}`,
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
    max_tokens: 1200,
    system: `You are BlockForecast Bot — an on-chain Solana trading terminal AI replying on X.

BlockForecast: live charts, 1-click buy/sell, Kafka sniper, LP drain alerts, smart money tracker, dev wallet scoring, wash trade detection, Jito MEV protection.

Someone tagged you asking about a token. You scanned it on-chain. The structured data header is already prepended before your reply — DO NOT repeat it. Start directly with your analysis paragraphs.

Write ONE reply post — no tweet splitting. Four paragraphs + CTA:

Paragraph 1 — Volume and momentum read: Compute the vol/MC ratio. Is the volume organic or coordinated given the flags? Is the momentum real — is the 1h pump fading on the 5m or accelerating? What does the trade count vs holder count ratio tell you? Be specific with the numbers you compute.

Paragraph 2 — Risk breakdown (label it "Risk breakdown:"): Explain every flag in plain terms with real dollar math. For concentrated wallets: calculate exact dollar exit pressure (e.g. "29% of $18K MC = $5.2K sitting above you"). For insider wallets: explain what coordinated pre-distribution means for the people buying now. For LP flags: what does thin LP mean when it turns. Quantify the downside, not just name it.

Paragraph 3 — Setup identification + smart money: Name the exact setup this is ("This is a narrative/cabal play", "This is a graduation play", "This is a classic rug structure", "This is a dead cat"). Weave in the smart money signal here — if large wallets are present, name their address prefix and volume, and explain what their positioning means in context of this setup. If none, say so plainly and explain what absence of smart money means for this specific setup.

Paragraph 4 — Entry or stay away: If there's a trade, give a concrete entry: specific MC level to enter under, stop loss percentage, and the thesis in one sentence. If it's a cabal/narrative play, state the risk/reward honestly. If it's a rug or dead cat, say stay away and explain in one brutal sentence exactly why chasing it ends badly.

Then a blank line, then the CTA line exactly as given.

Setup identification rules:
— CABAL/NARRATIVE PLAY: many coordinated insider wallets + name tied to a trending theme (oil, AI, Elon, politics, memes) → "This is a narrative/cabal play — the on-chain structure is engineered, not organic. It can still 3-5x or crater depending on whether the coordinating wallets are still accumulating or rotating out."
— GRADUATION PLAY: bonding curve 80%+ → call it explicitly, give entry logic around the graduation event and Raydium listing
— CLASSIC RUG: low holder count + high creator concentration + no narrative + low vol → say rug plainly, no entry
— DEAD CAT BOUNCE: 1h red + 5m green + fading volume → name it, explain the trap

Rules:
— Use the safety score label EXACTLY as given — never reword it
— If score says RUG RISK, never imply safety
— Do real math with the actual numbers (vol/MC ratios, dollar amounts from percentages)
— No hashtags. No "DYOR". No filler phrases.
— Sound like someone who's traded 1000 pumps and seen every setup
— Output ONLY the post text, nothing else`,
    messages: [{ role: "user", content: ctx }],
  });

  const message = await stream.finalMessage();
  let post = extractText(message.content as Anthropic.Messages.ContentBlock[]);

  // Always prepend the structured stats header
  post = statsBlock + "\n\n" + post;

  // Ensure CTA is present
  if (!post.includes("BlockForecasthq") && !post.includes(APP_URL)) {
    post = post.trimEnd() + `\n\n${cta}`;
  }

  return [post];
}

function rugVerdict(score: number): string {
  if (score === 0)  return "0/100 — RUG RISK 🚨";
  if (score <= 20)  return `${score}/100 — RUG RISK 🚨`;
  if (score <= 40)  return `${score}/100 — HIGH RISK 🔴`;
  if (score <= 60)  return `${score}/100 — RISKY ⚠️`;
  if (score <= 79)  return `${score}/100 — MODERATE 🟡`;
  return `${score}/100 — CLEAN 🟢`;
}

// ─── General crypto question reply (single tweet) ────────────────────────────

export async function generateCryptoReply(question: string): Promise<string[]> {
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
  let post = extractText(message.content as Anthropic.Messages.ContentBlock[]);

  if (!post.includes(X_HANDLE) && !post.includes(APP_URL)) {
    post = post.trimEnd() + `\n\n${cta}`;
  }

  return [post];
}
