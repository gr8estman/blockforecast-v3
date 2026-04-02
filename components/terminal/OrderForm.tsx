"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTradingStore } from "@/store/tradingStore";
import { useWalletStore } from "@/store/walletStore";
import { placePaperOrder, getPaperBalance, getPaperPositions, updatePositionPrices } from "@/lib/wallet/paper-trading";
import { formatPrice, formatAmount, formatUsd, formatPct } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Button, NumberInput, Badge, SectionHeader } from "@/components/ui";
import { TrendingUp, TrendingDown, FlaskConical, AlertCircle, Zap, Shield } from "lucide-react";
import { Position } from "@/types";

const QUICK_BUYS  = [10, 25, 50, 100];
const QUICK_SELLS = [0.25, 0.5, 0.75, 1];
const SLIPPAGE_PRESETS = [5, 10, 20, 30];
const PRIORITY_PRESETS: Array<{ label: string; value: "low" | "medium" | "high" | "veryHigh" }> = [
  { label: "Low",   value: "low"      },
  { label: "High",  value: "high"     },
  { label: "Turbo", value: "veryHigh" },
];

interface PumpQuote {
  estimatedTokens: number;
  pricePerToken: number;
  solIn: number;
}

export function OrderForm() {
  const { activeToken, activeTokenMeta, livePrice } = useTradingStore();
  const { isPaperTrading, mode, phantomConnected, generated } = useWalletStore();

  const [side, setSide]           = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("market");
  const [amountUsd, setAmountUsd] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [slippage, setSlippage]   = useState(10);
  const [priority, setPriority]   = useState<"low" | "medium" | "high" | "veryHigh">("high");
  const [useJito, setUseJito]     = useState(false);
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState<{ success: boolean; msg: string } | null>(null);
  const [paperBalance, setPaperBalance] = useState(0);
  const [openPosition, setOpenPosition] = useState<Position | null>(null);
  const [pumpQuote, setPumpQuote] = useState<PumpQuote | null>(null);
  const quoteTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isWalletReady =
    isPaperTrading ||
    (mode === "phantom" && phantomConnected) ||
    (mode === "generated" && !!generated);

  useEffect(() => {
    if (!isPaperTrading) return;
    setPaperBalance(getPaperBalance());
    if (activeToken && livePrice > 0) updatePositionPrices({ [activeToken]: livePrice });
    setOpenPosition(getPaperPositions().find((p) => p.tokenAddress === activeToken) ?? null);
  }, [livePrice, activeToken, isPaperTrading, result]);

  // Real slippage preview via bonding curve quote (debounced, buy side only)
  useEffect(() => {
    if (isPaperTrading || side !== "buy" || !activeToken || !amountUsd || livePrice <= 0) {
      setPumpQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(async () => {
      try {
        const solPrice = await fetch("https://price.jup.ag/v6/price?ids=SOL")
          .then((r) => r.json()).then((d) => Number(d?.data?.SOL?.price ?? 0));
        if (!solPrice) return;
        const sol = parseFloat(amountUsd) / solPrice;
        const q = await fetch(`/api/snipe`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "quote", tokenAddress: activeToken, solAmount: sol }),
        }).then((r) => r.json());
        if (q?.estimatedTokens) setPumpQuote(q);
      } catch { /* ignore */ }
    }, 600);
    return () => { if (quoteTimer.current) clearTimeout(quoteTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountUsd, activeToken, side, isPaperTrading]);

  const handleQuickBuy  = useCallback((usd: number) => setAmountUsd(usd.toFixed(2)), []);
  const handleQuickSell = useCallback((frac: number) => {
    const base = openPosition ? openPosition.valueUsd : paperBalance;
    setAmountUsd((base * frac).toFixed(2));
  }, [openPosition, paperBalance]);

  // Keyboard hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "b": setSide("buy");  break;
        case "s": setSide("sell"); break;
        case "1": setSide("buy");  setAmountUsd(QUICK_BUYS[0].toFixed(2)); break;
        case "2": setSide("buy");  setAmountUsd(QUICK_BUYS[1].toFixed(2)); break;
        case "3": setSide("buy");  setAmountUsd(QUICK_BUYS[2].toFixed(2)); break;
        case "4": setSide("buy");  setAmountUsd(QUICK_BUYS[3].toFixed(2)); break;
        case "q": setSide("sell"); handleQuickSell(0.25); break;
        case "w": setSide("sell"); handleQuickSell(0.5);  break;
        case "e": setSide("sell"); handleQuickSell(0.75); break;
        case "r": setSide("sell"); handleQuickSell(1);    break;
        case "escape": setResult(null); setAmountUsd(""); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleQuickSell]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeToken || !activeTokenMeta || !amountUsd) return;
    setLoading(true);
    setResult(null);
    try {
      if (isPaperTrading) {
        const currentPrice = livePrice || activeTokenMeta.currentPrice;
        const prePos = getPaperPositions().find((p) => p.tokenAddress === activeToken);
        const res = placePaperOrder({
          tokenAddress: activeToken,
          tokenSymbol:  activeTokenMeta.symbol,
          tokenName:    activeTokenMeta.name,
          side,
          type: orderType,
          amountUsd: parseFloat(amountUsd),
          currentPriceUsd: currentPrice,
          limitPrice: limitPrice ? parseFloat(limitPrice) : undefined,
        });
        let msg = res.success
          ? `Paper ${side} filled at ${formatPrice(currentPrice)}`
          : res.error ?? "Order failed";
        if (res.success && side === "sell" && prePos) {
          const tokensSold  = parseFloat(amountUsd) / currentPrice;
          const realizedPnl = (currentPrice - prePos.entryPrice) * tokensSold;
          const pnlPct      = ((currentPrice - prePos.entryPrice) / prePos.entryPrice) * 100;
          msg += ` · P&L: ${realizedPnl >= 0 ? "+" : ""}${formatUsd(realizedPnl)} (${formatPct(pnlPct)})`;
        }
        setResult({ success: res.success, msg });

      } else if (mode === "generated" && generated?.secretKey) {
        // Real on-chain trade via pump.fun bonding curve + Helius RPC
        const priceRes  = await fetch("https://price.jup.ag/v6/price?ids=SOL");
        const priceData = await priceRes.json();
        const solPrice  = Number(priceData?.data?.SOL?.price ?? 0);
        if (!solPrice) throw new Error("SOL price unavailable — retry");

        const currentPrice = livePrice || activeTokenMeta.currentPrice;

        if (side === "buy") {
          const solAmount = parseFloat(amountUsd) / solPrice;
          const res  = await fetch("/api/snipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "buy", tokenAddress: activeToken, solAmount, slippage, priority, secretKey: generated.secretKey, useJito }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error ?? "Buy failed");
          setResult({ success: true, msg: `Bought ${formatAmount(parseFloat(amountUsd) / currentPrice)} tokens · tx: ${String(data.txHash ?? "").slice(0, 8)}…` });
        } else {
          const tokenAmount = currentPrice > 0 ? parseFloat(amountUsd) / currentPrice : 0;
          if (tokenAmount <= 0) throw new Error("Invalid sell amount");
          const res  = await fetch("/api/snipe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "sell", tokenAddress: activeToken, tokenAmount, slippage, priority, secretKey: generated.secretKey }),
          });
          const data = await res.json();
          if (!data.success) throw new Error(data.error ?? "Sell failed");
          setResult({ success: true, msg: `Sold ${formatAmount(tokenAmount)} tokens · tx: ${String(data.txHash ?? "").slice(0, 8)}…` });
        }

      } else if (mode === "phantom" && phantomConnected) {
        setResult({ success: false, msg: "Phantom on-chain signing coming soon — use Generated Wallet" });
      } else {
        setResult({ success: false, msg: "No wallet connected" });
      }
    } catch (err) {
      setResult({ success: false, msg: String(err) });
    } finally {
      setLoading(false);
      setTimeout(() => setResult(null), 5000);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#050505] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 h-7 border-b border-[#111] shrink-0">
        <span className="text-[10px] text-[#555] uppercase tracking-wider">Order</span>
        {isPaperTrading && (
          <span className="flex items-center gap-1 text-[9px] text-[#d29922] font-mono">
            <FlaskConical size={9} />PAPER
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 p-2.5 overflow-y-auto" style={{ scrollbarWidth: "none" }}>

        {/* BUY / SELL — big split buttons */}
        <div className="grid grid-cols-2 gap-1">
          <button type="button" onClick={() => setSide("buy")}
            className={cn("h-8 rounded text-[12px] font-bold transition-all flex items-center justify-center gap-1",
              side === "buy"
                ? "bg-[#0d3330] text-[#2dd4bf] border border-[#2dd4bf]/40"
                : "bg-[#0a0a0a] text-[#333] border border-[#1a1a1a] hover:text-[#555]")}>
            <TrendingUp size={12} />BUY
          </button>
          <button type="button" onClick={() => setSide("sell")}
            className={cn("h-8 rounded text-[12px] font-bold transition-all flex items-center justify-center gap-1",
              side === "sell"
                ? "bg-[#330d12] text-[#fb7185] border border-[#fb7185]/40"
                : "bg-[#0a0a0a] text-[#333] border border-[#1a1a1a] hover:text-[#555]")}>
            <TrendingDown size={12} />SELL
          </button>
        </div>

        {/* Order type + price */}
        <div className="flex gap-1">
          {(["market", "limit"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setOrderType(t)}
              className={cn("flex-1 h-6 rounded text-[10px] font-medium border transition-all",
                orderType === t
                  ? "bg-[#111] border-[#333] text-[#c9d1d9]"
                  : "border-[#111] text-[#333] hover:text-[#555]")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Price display */}
        {activeTokenMeta && (
          <div className="flex items-center justify-between px-2 h-7 bg-[#0a0a0a] rounded border border-[#111]">
            <span className="text-[10px] text-[#333] font-mono">{activeTokenMeta.symbol}</span>
            <span className="text-[11px] font-mono text-[#2dd4bf]">{formatPrice(livePrice || activeTokenMeta.currentPrice)}</span>
          </div>
        )}

        {/* Limit Price */}
        {orderType === "limit" && (
          <NumberInput prefix="$" placeholder="Limit price" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} />
        )}

        {/* Amount */}
        <NumberInput prefix="$" placeholder="Amount USD" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} />

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-1">
          {side === "buy"
            ? QUICK_BUYS.map((amt, i) => (
                <button key={amt} type="button" onClick={() => handleQuickBuy(amt)}
                  className="h-7 rounded border border-[#111] text-[10px] text-[#333] hover:border-[#333] hover:text-[#c9d1d9] transition-all font-mono">
                  ${amt}
                </button>
              ))
            : QUICK_SELLS.map((frac) => (
                <button key={frac} type="button" onClick={() => handleQuickSell(frac)}
                  className="h-7 rounded border border-[#111] text-[10px] text-[#333] hover:border-[#333] hover:text-[#c9d1d9] transition-all font-mono">
                  {frac * 100}%
                </button>
              ))}
        </div>

        {/* Preview */}
        {amountUsd && livePrice > 0 && (
          <div className="bg-[#0a0a0a] rounded border border-[#111] px-2 py-1.5 text-[10px] font-mono space-y-0.5">
            {pumpQuote && side === "buy" && !isPaperTrading ? (
              <>
                <div className="flex justify-between">
                  <span className="text-[#333]">Tokens</span>
                  <span className="text-[#2dd4bf]">{formatAmount(pumpQuote.estimatedTokens)}</span>
                </div>
                {livePrice > 0 && pumpQuote.pricePerToken > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[#333]">Slippage</span>
                    <span className={cn("font-bold",
                      Math.abs((pumpQuote.pricePerToken - livePrice) / livePrice * 100) > 5
                        ? "text-[#fb7185]" : "text-[#2dd4bf]")}>
                      {((pumpQuote.pricePerToken - livePrice) / livePrice * 100).toFixed(2)}%
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="flex justify-between">
                <span className="text-[#333]">Tokens (est.)</span>
                <span className="text-[#c9d1d9]">{formatAmount(parseFloat(amountUsd) / livePrice)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[#111] pt-0.5 mt-0.5">
              <span className="text-[#333]">Total</span>
              <span className="text-[#c9d1d9]">${parseFloat(amountUsd || "0").toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Paper position */}
        {isPaperTrading && (openPosition || paperBalance > 0) && (
          <div className="bg-[#0a0a0a] rounded border border-[#111] px-2 py-1.5 text-[10px] font-mono space-y-0.5">
            <div className="flex justify-between">
              <span className="text-[#333]">Balance</span>
              <span className="text-[#c9d1d9]">${paperBalance.toFixed(2)}</span>
            </div>
            {openPosition && (
              <>
                <div className="flex justify-between">
                  <span className="text-[#333]">Entry</span>
                  <span className="text-[#c9d1d9]">{formatPrice(openPosition.entryPrice)}</span>
                </div>
                <div className="flex justify-between border-t border-[#111] pt-0.5 mt-0.5">
                  <span className="text-[#333]">P&L</span>
                  <span className={openPosition.pnl >= 0 ? "text-[#2dd4bf]" : "text-[#fb7185]"}>
                    {openPosition.pnl >= 0 ? "+" : ""}{formatUsd(openPosition.pnl)} ({formatPct(openPosition.pnlPct)})
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* Slippage */}
        {!isPaperTrading && (
          <div className="grid grid-cols-4 gap-1">
            {SLIPPAGE_PRESETS.map((s) => (
              <button key={s} type="button" onClick={() => setSlippage(s)}
                className={cn("h-6 rounded text-[10px] border transition-all font-mono",
                  slippage === s ? "bg-[#111] border-[#333] text-[#c9d1d9]"
                    : "border-[#111] text-[#333] hover:text-[#555]")}>
                {s}%
              </button>
            ))}
          </div>
        )}

        {/* Priority */}
        {!isPaperTrading && !useJito && (
          <div className="grid grid-cols-3 gap-1">
            {PRIORITY_PRESETS.map(({ label, value }) => (
              <button key={value} type="button" onClick={() => setPriority(value)}
                className={cn("h-6 rounded text-[10px] border transition-all",
                  priority === value ? "bg-[#111] border-[#333] text-[#c9d1d9]"
                    : "border-[#111] text-[#333] hover:text-[#555]")}>
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Jito */}
        {!isPaperTrading && side === "buy" && (
          <button type="button" onClick={() => setUseJito((v) => !v)}
            className={cn("w-full h-7 flex items-center justify-between px-2 rounded border text-[10px] transition-all",
              useJito ? "bg-[#110d1e] border-[#7c3aed]/40 text-[#a78bfa]" : "border-[#111] text-[#333] hover:text-[#555]")}>
            <span className="flex items-center gap-1"><Shield size={9} />Jito MEV</span>
            <span className={cn("text-[9px]", useJito ? "text-[#a78bfa]" : "text-[#222]")}>
              {useJito ? "ON ⚡" : "OFF"}
            </span>
          </button>
        )}

        {!isWalletReady && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#d29922] px-2 py-1.5 bg-[#1a1200] rounded border border-[#d29922]/20">
            <AlertCircle size={10} />Connect wallet
          </div>
        )}

        {result && (
          <div className={cn("text-[10px] rounded px-2 py-1.5 font-mono break-all border",
            result.success
              ? "bg-[#061a10] text-[#2dd4bf] border-[#2dd4bf]/20"
              : "bg-[#1a0608] text-[#fb7185] border-[#fb7185]/20")}>
            {result.msg}
          </div>
        )}

        {/* Submit */}
        <button type="submit"
          disabled={loading || !activeToken || !isWalletReady || !amountUsd}
          className={cn(
            "w-full h-10 rounded font-bold text-[13px] transition-all flex items-center justify-center gap-2 disabled:opacity-40",
            side === "buy"
              ? "bg-[#0d3330] hover:bg-[#0f3d3a] text-[#2dd4bf] border border-[#2dd4bf]/30"
              : "bg-[#330d12] hover:bg-[#3d0f15] text-[#fb7185] border border-[#fb7185]/30",
          )}>
          {loading && <span className="w-3.5 h-3.5 rounded-full border border-current border-t-transparent animate-spin" />}
          {isPaperTrading ? "PAPER " : ""}{side === "buy" ? "BUY" : "SELL"} {activeTokenMeta?.symbol ?? "TOKEN"}
        </button>

        <p className="text-[9px] text-[#222] text-center font-mono">B/S · 1-4 · Q/W/E/R · ESC</p>
      </form>
    </div>
  );
}
