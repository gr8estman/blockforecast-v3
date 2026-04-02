import { NextRequest, NextResponse } from "next/server";
import { snipePumpToken, snipePumpTokenJito, sellPumpToken, getPumpQuote } from "@/lib/trading/sniper";

/**
 * POST /api/snipe
 * Body: {
 *   action: "buy" | "sell" | "quote",
 *   tokenAddress: string,
 *   solAmount?: number,       // for buy / quote
 *   tokenAmount?: number,     // for sell (UI units)
 *   slippage?: number,        // % default 10
 *   priority?: "low"|"medium"|"high"|"veryHigh",
 *   secretKey: string,        // base58 private key (generated wallet only)
 *   useJito?: boolean,        // submit as Jito MEV-protected bundle
 *   jitoTipLamports?: number, // tip amount (default 1_000_000 = 0.001 SOL)
 * }
 */
export async function POST(req: NextRequest) {
  let body: {
    action: string;
    tokenAddress: string;
    solAmount?: number;
    tokenAmount?: number;
    slippage?: number;
    priority?: "low" | "medium" | "high" | "veryHigh";
    secretKey?: string;
    useJito?: boolean;
    jitoTipLamports?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action, tokenAddress, solAmount, tokenAmount, slippage = 10, priority = "high", secretKey, useJito = false, jitoTipLamports = 1_000_000 } = body;

  if (!tokenAddress || tokenAddress.length < 10) {
    return NextResponse.json({ error: "Invalid tokenAddress" }, { status: 400 });
  }

  // ── Quote (no key required) ──────────────────────────────────────────────
  if (action === "quote") {
    const sol = solAmount ?? 0.1;
    const quote = await getPumpQuote(tokenAddress, sol);
    if (!quote) {
      return NextResponse.json({ error: "Bonding curve not found or token graduated" }, { status: 404 });
    }
    return NextResponse.json(quote);
  }

  // ── Buy / Sell (requires secret key) ─────────────────────────────────────
  if (!secretKey) {
    return NextResponse.json({ error: "secretKey required for buy/sell" }, { status: 400 });
  }

  if (action === "buy") {
    if (!solAmount || solAmount <= 0) {
      return NextResponse.json({ error: "solAmount required for buy" }, { status: 400 });
    }
    const result = useJito
      ? await snipePumpTokenJito(tokenAddress, solAmount, slippage, secretKey, jitoTipLamports)
      : await snipePumpToken(tokenAddress, solAmount, slippage, secretKey, priority);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  if (action === "sell") {
    if (!tokenAmount || tokenAmount <= 0) {
      return NextResponse.json({ error: "tokenAmount required for sell" }, { status: 400 });
    }
    const result = await sellPumpToken(tokenAddress, tokenAmount, slippage, secretKey, priority);
    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
