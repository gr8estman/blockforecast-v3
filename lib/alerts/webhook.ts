import { RugCheckResult } from "@/types";

const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

async function sendToMake(payload: WebhookPayload): Promise<boolean> {
  if (!MAKE_WEBHOOK_URL) return false;
  try {
    const res = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error("[webhook]", err);
    return false;
  }
}

// ─── Rug Alert ────────────────────────────────────────────────────────────────

export async function sendRugAlert(result: RugCheckResult): Promise<void> {
  await sendToMake({
    event: "RUG_DETECTED",
    timestamp: new Date().toISOString(),
    data: {
      tokenAddress: result.tokenAddress,
      tokenName: result.tokenName,
      tokenSymbol: result.tokenSymbol,
      rugScore: result.overallScore,
      riskLevel: result.riskLevel,
      flags: result.flags,
      creatorHolding: result.creatorHoldingPct,
      top10Holders: result.top10HoldersPct,
      washTradingScore: result.washTrading.score,
      preDistributed: result.preDistributed,
      graduated: result.graduated,
      solscanUrl: `https://solscan.io/token/${result.tokenAddress}`,
    },
  });
}

// ─── Price Alert ──────────────────────────────────────────────────────────────

export async function sendPriceAlert(
  tokenAddress: string,
  tokenSymbol: string,
  currentPrice: number,
  changePercent: number,
  direction: "up" | "down"
): Promise<void> {
  await sendToMake({
    event: direction === "up" ? "PRICE_SPIKE" : "PRICE_DUMP",
    timestamp: new Date().toISOString(),
    data: {
      tokenAddress,
      tokenSymbol,
      currentPrice,
      changePercent,
      direction,
      chartUrl: `${process.env.NEXT_PUBLIC_APP_URL}/terminal/${tokenAddress}`,
    },
  });
}

// ─── New Token Alert ──────────────────────────────────────────────────────────

export async function sendNewTokenAlert(
  tokenAddress: string,
  tokenSymbol: string,
  tokenName: string,
  devAddress: string
): Promise<void> {
  await sendToMake({
    event: "NEW_TOKEN_LAUNCHED",
    timestamp: new Date().toISOString(),
    data: {
      tokenAddress,
      tokenSymbol,
      tokenName,
      devAddress,
      analysisUrl: `${process.env.NEXT_PUBLIC_APP_URL}/rug-analysis/${tokenAddress}`,
      tradeUrl: `${process.env.NEXT_PUBLIC_APP_URL}/terminal/${tokenAddress}`,
    },
  });
}

// ─── Trade Alert ──────────────────────────────────────────────────────────────

export async function sendTradeAlert(trade: {
  tokenAddress: string;
  tokenSymbol: string;
  side: "buy" | "sell";
  amountUsd: number;
  price: number;
  isPaper: boolean;
  txHash?: string;
}): Promise<void> {
  await sendToMake({
    event: "TRADE_EXECUTED",
    timestamp: new Date().toISOString(),
    data: {
      ...trade,
      txUrl: trade.txHash
        ? `https://solscan.io/tx/${trade.txHash}`
        : null,
    },
  });
}
