import "dotenv/config";
import { readFileSync, writeFileSync } from "fs";
import { XClient, type MentionTweet } from "./twitter.js";
import { analyzeToken } from "./analyzer.js";
import { generateTokenReply, generateCryptoReply } from "./generator.js";

const POLL_MS      = Number(process.env.POLL_INTERVAL_MS ?? 120_000);
const DAILY_CAP    = 90; // X Basic: 100 posts/day — stay under with buffer
const STATE_FILE   = new URL("../../.bot-state.json", import.meta.url).pathname;
const CA_REGEX     = /(?<![A-Za-z0-9])([1-9A-HJ-NP-Za-km-z]{32,44})(?![A-Za-z0-9])/g;
// Keywords matched only against the mention tweet itself (not parent post)
const CRYPTO_KW    = ["pump.fun","raydium","rug check","is it safe","any alpha","new token","rug pull","contract address","what do you think","check this","scan this"];

interface BotState { lastMentionId?: string; repliedTo: string[]; postsToday: number; postDayReset: string; }

function loadState(): BotState {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")) as BotState; }
  catch { return { repliedTo: [], postsToday: 0, postDayReset: today() }; }
}

function today() { return new Date().toISOString().slice(0, 10); }

function checkDailyCap(state: BotState): boolean {
  if (state.postDayReset !== today()) {
    state.postsToday = 0;
    state.postDayReset = today();
  }
  return state.postsToday < DAILY_CAP;
}

function trackPost(state: BotState) {
  if (state.postDayReset !== today()) { state.postsToday = 0; state.postDayReset = today(); }
  state.postsToday++;
  saveState(state);
}

function saveState(s: BotState) {
  s.repliedTo = s.repliedTo.slice(-500);
  try { writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch {}
}

function isValidCA(ca: string) {
  return ca.length >= 32 && new Set(ca).size >= 6 && ca !== "So11111111111111111111111111111111111111112";
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function processMention(xClient: XClient, tweet: MentionTweet, state: BotState) {
  if (state.repliedTo.includes(tweet.id)) return;

  // Daily cap check — stop before hitting X's 100/day limit
  if (!checkDailyCap(state)) {
    console.warn(`[bot] Daily cap reached (${state.postsToday}/${DAILY_CAP}) — skipping ${tweet.id}`);
    return;
  }

  state.repliedTo.push(tweet.id);
  saveState(state);

  console.log(`\n[bot] Mention ${tweet.id}: "${tweet.mentionText.slice(0, 100)}"`);

  // CA scan on combined text (includes parent tweet — catches CAs shared in context)
  const cas = [...tweet.text.matchAll(CA_REGEX)].map(m => m[1]).filter(isValidCA);
  if (cas.length > 0) {
    const ca = cas[0];
    console.log(`[bot]   CA: ${ca}`);
    const analysis = await analyzeToken(ca);
    if (!analysis) {
      await xClient.replyWithThread(tweet.id, ["BlockForecast got you — no on-chain data yet, token may be too new. Check back in a few minutes at blockforecast.io"]);
      trackPost(state);
      return;
    }
    console.log(`[bot]   $${analysis.symbol} score=${analysis.rugScore}`);
    await xClient.replyWithThread(tweet.id, await generateTokenReply(analysis), analysis.imageUrl);
    trackPost(state);
    return;
  }

  // Keyword fallback — only on the mention itself, NOT the parent post
  if (CRYPTO_KW.some(kw => tweet.mentionText.toLowerCase().includes(kw))) {
    await xClient.replyWithThread(tweet.id, await generateCryptoReply(tweet.mentionText));
    trackPost(state);
    return;
  }

  console.log("[bot]   skip — no CA or intent keywords in mention");
}

async function pollMentions(xClient: XClient, state: BotState) {
  try {
    const mentions = await xClient.getMentions(state.lastMentionId);
    if (!mentions.length) { process.stdout.write("."); return; }
    const sorted = [...mentions].sort((a, b) => a.id.localeCompare(b.id));
    state.lastMentionId = sorted.at(-1)!.id;
    saveState(state);
    console.log(`\n[bot] ${sorted.length} new mention(s)`);
    for (const tweet of sorted) { await processMention(xClient, tweet, state); await sleep(8000); }
  } catch (err) {
    console.error("\n[bot] Poll error:", err instanceof Error ? err.message : err);
  }
}

async function main() {
  const missing = ["X_API_KEY","X_API_SECRET","X_ACCESS_TOKEN","X_ACCESS_SECRET","ANTHROPIC_API_KEY","BITQUERY_API_KEY"]
    .filter(k => !process.env[k]);
  if (missing.length) { console.error(`[bot] Missing env vars: ${missing.join(", ")}`); process.exit(1); }

  const state   = loadState();
  const xClient = new XClient();
  const botId   = await xClient.getBotUserId();

  console.log(`[bot] Started | ID: ${botId} | resume from: ${state.lastMentionId ?? "fresh start"} | poll: ${POLL_MS/1000}s`);
  await pollMentions(xClient, state);
  setInterval(() => pollMentions(xClient, state), POLL_MS);
}

main().catch(err => { console.error("[bot] Fatal:", err); process.exit(1); });
