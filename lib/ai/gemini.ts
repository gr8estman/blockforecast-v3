import { GoogleGenerativeAI } from "@google/generative-ai";
import { RugCheckResult } from "@/types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// ─── AI Token Risk Assessment ─────────────────────────────────────────────────

export interface AIRiskAssessment {
  verdict: "BUY" | "AVOID" | "CAUTION" | "HOLD";
  confidence: number;        // 0-100
  summary: string;           // 1-2 sentence plain-English verdict
  reasoning: string[];       // bullet points
  priceTarget?: string;
  riskFactors: string[];
  bullishFactors: string[];
  timestamp: string;
}

export async function analyzeTokenRisk(
  rugResult: RugCheckResult,
  marketData?: {
    price: number;
    priceChange5m: number;
    priceChange1h: number;
    volume24h: number;
    marketCap: number;
    holders: number;
    liquidity: number;
  }
): Promise<AIRiskAssessment> {
  const prompt = `You are an expert Solana memecoin analyst. Analyze this token and give a concise trading verdict.

TOKEN DATA:
- Name: ${rugResult.tokenName} (${rugResult.tokenSymbol})
- Address: ${rugResult.tokenAddress}
- Rug Score: ${rugResult.overallScore}/100 (higher = safer)
- Risk Level: ${rugResult.riskLevel.toUpperCase()}
- Graduated from pump.fun: ${rugResult.graduated ? "YES" : "NO (still on bonding curve)"}

HOLDER ANALYSIS:
- Creator holding: ${rugResult.creatorHoldingPct.toFixed(2)}%
- Top 10 wallets: ${rugResult.top10HoldersPct.toFixed(2)}%
- Pre-distribution detected: ${rugResult.preDistributed ? "YES (insider seeding)" : "NO"}
- Total holders shown: ${rugResult.holders.length}

TRADING ACTIVITY:
- Wash trading score: ${rugResult.washTrading.score}/100 (higher = more wash trading)
- Self-trades detected: ${rugResult.washTrading.selfTradeCount}
- Suspicious wallets: ${rugResult.washTrading.suspiciousWallets.length}

${marketData ? `MARKET DATA:
- Current price: $${marketData.price}
- 5m price change: ${marketData.priceChange5m.toFixed(2)}%
- 1h price change: ${marketData.priceChange1h.toFixed(2)}%
- 24h volume: $${marketData.volume24h.toFixed(0)}
- Market cap: $${marketData.marketCap.toFixed(0)}
- Holders: ${marketData.holders}
- Liquidity: $${marketData.liquidity.toFixed(0)}` : ""}

FLAGS:
${rugResult.flags.length > 0 ? rugResult.flags.map(f => `- ${f}`).join("\n") : "- No major flags"}

Respond ONLY with valid JSON in this exact format:
{
  "verdict": "BUY" | "AVOID" | "CAUTION" | "HOLD",
  "confidence": <0-100>,
  "summary": "<1-2 sentence plain English verdict>",
  "reasoning": ["<point 1>", "<point 2>", "<point 3>"],
  "riskFactors": ["<risk 1>", "<risk 2>"],
  "bullishFactors": ["<bull 1>", "<bull 2>"]
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in AI response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      verdict: parsed.verdict ?? "CAUTION",
      confidence: Math.min(100, Math.max(0, parsed.confidence ?? 50)),
      summary: parsed.summary ?? "Analysis unavailable",
      reasoning: parsed.reasoning ?? [],
      riskFactors: parsed.riskFactors ?? [],
      bullishFactors: parsed.bullishFactors ?? [],
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    console.error("[gemini] analyzeTokenRisk failed:", err);
    return {
      verdict: "CAUTION",
      confidence: 0,
      summary: "AI analysis unavailable — rely on rug score and flags.",
      reasoning: ["AI analysis failed — check token manually"],
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
  ohlcv: Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>;
  volume24h: number;
  priceChange5m: number;
  priceChange1h: number;
  rugScore: number;
  holders: number;
}): Promise<AITradingSignal> {
  const recent = data.ohlcv.slice(-20);
  const prices = recent.map(b => b.close);
  const avgVol = recent.reduce((s, b) => s + b.volume, 0) / (recent.length || 1);
  const lastVol = recent[recent.length - 1]?.volume ?? 0;
  const volSpike = avgVol > 0 ? ((lastVol - avgVol) / avgVol * 100).toFixed(1) : "0";

  const prompt = `You are a professional Solana memecoin trader. Give a short-term trading signal.

TOKEN: ${data.symbol}
Price: $${data.currentPrice}
5m change: ${data.priceChange5m.toFixed(2)}%
1h change: ${data.priceChange1h.toFixed(2)}%
24h volume: $${data.volume24h.toFixed(0)}
Rug score: ${data.rugScore}/100
Holders: ${data.holders}
Volume spike: ${volSpike}% vs 20-bar avg
Recent closes: ${prices.slice(-5).map(p => p.toFixed(8)).join(", ")}

Respond ONLY in JSON:
{
  "action": "STRONG_BUY" | "BUY" | "HOLD" | "SELL" | "STRONG_SELL",
  "entryPrice": <number or null>,
  "targetPrice": <number or null>,
  "stopLoss": <number or null>,
  "confidence": <0-100>,
  "rationale": "<one sentence>",
  "timeframe": "<e.g. 5-15 minutes>"
}`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in signal response");

    const parsed = JSON.parse(jsonMatch[0]);
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
    console.error("[gemini] generateTradingSignal failed:", err);
    return {
      action: "HOLD",
      confidence: 0,
      rationale: "Signal generation failed",
      timeframe: "N/A",
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── DeepSeek Fallback ────────────────────────────────────────────────────────

export async function analyzeWithDeepSeek(prompt: string): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) return "DeepSeek not configured";

  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 512,
        temperature: 0.3,
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek ${res.status}`);
    const json = await res.json();
    return json.choices?.[0]?.message?.content ?? "";
  } catch (err) {
    console.error("[deepseek]", err);
    return "";
  }
}
