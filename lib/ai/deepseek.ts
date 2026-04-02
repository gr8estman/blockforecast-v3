import { RugCheckResult } from "@/types";

const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

async function deepseekChat(prompt: string, systemPrompt: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not set");

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      max_tokens: 600,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.choices?.[0]?.message?.content ?? "";
}

// ─── AI Risk Assessment ───────────────────────────────────────────────────────

export interface AIRiskAssessment {
  verdict: "BUY" | "AVOID" | "CAUTION" | "HOLD";
  confidence: number;
  summary: string;
  reasoning: string[];
  riskFactors: string[];
  bullishFactors: string[];
  timestamp: string;
}

export async function analyzeTokenRisk(
  rug: RugCheckResult,
  marketData?: {
    price: number;
    priceChange1h: number;
    volume24h: number;
    marketCap: number;
    holders: number;
    liquidity: number;
  }
): Promise<AIRiskAssessment> {
  const system =
    "You are an expert Solana memecoin risk analyst. Respond ONLY with valid JSON.";

  const prompt = `Analyze this Solana token and return a concise trading verdict.

TOKEN: ${rug.tokenName} (${rug.tokenSymbol}) — ${rug.tokenAddress}
Rug Score: ${rug.overallScore}/100 (higher=safer) | Risk: ${rug.riskLevel.toUpperCase()}
Graduated from pump.fun: ${rug.graduated ? "YES" : "NO"}

HOLDERS:
- Creator holding: ${rug.creatorHoldingPct.toFixed(2)}%
- Top 10 wallets: ${rug.top10HoldersPct.toFixed(2)}%
- Pre-distributed (insider seeding): ${rug.preDistributed ? "YES" : "NO"}
- Total holders: ${rug.holders.length}

WASH TRADING:
- Score: ${rug.washTrading.score}/100 (higher=more wash)
- Self-trades: ${rug.washTrading.selfTradeCount}
- Suspicious wallets: ${rug.washTrading.suspiciousWallets.length}

${
  marketData
    ? `MARKET:
- Price: $${marketData.price}
- 1h change: ${marketData.priceChange1h.toFixed(2)}%
- 24h volume: $${marketData.volume24h.toFixed(0)}
- Market cap: $${marketData.marketCap.toFixed(0)}
- Liquidity: $${marketData.liquidity.toFixed(0)}
- Holders: ${marketData.holders}`
    : ""
}

FLAGS: ${rug.flags.length ? rug.flags.join("; ") : "None"}

Return JSON:
{
  "verdict": "BUY"|"AVOID"|"CAUTION"|"HOLD",
  "confidence": 0-100,
  "summary": "1-2 sentence verdict",
  "reasoning": ["point1","point2","point3"],
  "riskFactors": ["risk1","risk2"],
  "bullishFactors": ["bull1","bull2"]
}`;

  try {
    const text = await deepseekChat(prompt, system);
    const parsed = JSON.parse(text);
    return {
      verdict: ["BUY", "AVOID", "CAUTION", "HOLD"].includes(parsed.verdict)
        ? parsed.verdict
        : "CAUTION",
      confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
      summary: parsed.summary ?? "Analysis unavailable.",
      reasoning: Array.isArray(parsed.reasoning) ? parsed.reasoning : [],
      riskFactors: Array.isArray(parsed.riskFactors) ? parsed.riskFactors : [],
      bullishFactors: Array.isArray(parsed.bullishFactors) ? parsed.bullishFactors : [],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[deepseek] analyzeTokenRisk failed:", err);
    return {
      verdict: "CAUTION",
      confidence: 0,
      summary: "AI analysis unavailable — review rug score and flags manually.",
      reasoning: ["AI analysis failed"],
      riskFactors: [],
      bullishFactors: [],
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── AI Trading Signal ────────────────────────────────────────────────────────

export interface AITradingSignal {
  action: "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL";
  entryPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: number;
  rationale: string;
  timeframe: string;
  timestamp: string;
}

export async function generateTradingSignal(data: {
  symbol: string;
  currentPrice: number;
  ohlcv: Array<{
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  volume24h: number;
  priceChange5m: number;
  priceChange1h: number;
  rugScore: number;
  holders: number;
}): Promise<AITradingSignal> {
  const system =
    "You are a professional Solana memecoin trader. Respond ONLY with valid JSON.";

  const recent = data.ohlcv.slice(-20);
  const closes = recent.map((b) => b.close);
  const volumes = recent.map((b) => b.volume);
  const avgVol = volumes.reduce((s, v) => s + v, 0) / (volumes.length || 1);
  const lastVol = volumes[volumes.length - 1] ?? 0;
  const volSpike = avgVol > 0 ? (((lastVol - avgVol) / avgVol) * 100).toFixed(1) : "0";

  const prompt = `Generate a short-term trading signal for this Solana memecoin.

TOKEN: ${data.symbol}
Price: $${data.currentPrice}
5m change: ${data.priceChange5m.toFixed(2)}%  |  1h change: ${data.priceChange1h.toFixed(2)}%
24h volume: $${data.volume24h.toFixed(0)}
Rug score: ${data.rugScore}/100  |  Holders: ${data.holders}
Volume spike vs 20-bar avg: ${volSpike}%
Recent 5 closes: ${closes.slice(-5).map((p) => p.toFixed(8)).join(", ")}

Return JSON:
{
  "action": "STRONG_BUY"|"BUY"|"HOLD"|"SELL"|"STRONG_SELL",
  "entryPrice": number|null,
  "targetPrice": number|null,
  "stopLoss": number|null,
  "confidence": 0-100,
  "rationale": "one sentence",
  "timeframe": "e.g. 5-15 minutes"
}`;

  try {
    const text = await deepseekChat(prompt, system);
    const parsed = JSON.parse(text);
    return {
      action: parsed.action ?? "HOLD",
      entryPrice: parsed.entryPrice ?? undefined,
      targetPrice: parsed.targetPrice ?? undefined,
      stopLoss: parsed.stopLoss ?? undefined,
      confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
      rationale: parsed.rationale ?? "",
      timeframe: parsed.timeframe ?? "Unknown",
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[deepseek] generateTradingSignal failed:", err);
    return {
      action: "HOLD",
      confidence: 0,
      rationale: "Signal generation failed — check data manually.",
      timeframe: "N/A",
      timestamp: new Date().toISOString(),
    };
  }
}
