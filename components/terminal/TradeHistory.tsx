"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTradingStore }     from "@/store/tradingStore";
import { subscribeToTrades }   from "@/lib/bitquery/websocket";
import { Trade }               from "@/types";
import { formatPrice, formatAmount, timeAgo, shortAddress } from "@/lib/utils";
import { cn }                  from "@/lib/utils";
import { Spinner }             from "@/components/ui";

// Max USD we use to normalise the volume bar (top 1% of trades)
const VOL_SCALE = 5_000;

function TradeRow({ trade, maxVol }: { trade: Trade; maxVol: number }) {
  const isBuy  = trade.side === "buy";
  const volPct = Math.min((trade.amountUsd / Math.max(maxVol, 1)) * 100, 100);

  return (
    <div className={cn(
      "relative flex items-center gap-0 px-2 text-[11px] font-mono",
      "h-[22px] overflow-hidden border-b border-[#0d0d0d]",
      "hover:bg-[#0f0f0f] transition-colors",
    )}>
      {/* Volume bar background */}
      <div
        className={cn("absolute left-0 top-0 h-full opacity-[0.07] pointer-events-none",
          isBuy ? "bg-[#2dd4bf]" : "bg-[#fb7185]")}
        style={{ width: `${volPct}%` }}
      />

      {/* Side label */}
      <span className={cn("w-7 shrink-0 font-bold text-[10px]", isBuy ? "text-[#2dd4bf]" : "text-[#fb7185]")}>
        {isBuy ? "B" : "S"}
      </span>

      {/* Price */}
      <span className="flex-1 text-[#c9d1d9] tabular-nums">{formatPrice(trade.priceUsd)}</span>

      {/* Amount tokens */}
      <span className="w-[68px] text-right text-[#555] tabular-nums">{formatAmount(trade.amount)}</span>

      {/* USD value */}
      <span className={cn("w-[60px] text-right tabular-nums font-medium",
        isBuy ? "text-[#2dd4bf]" : "text-[#fb7185]")}>
        ${formatAmount(trade.amountUsd)}
      </span>

      {/* Wallet */}
      <a
        href={`https://solscan.io/account/${trade.maker}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-[52px] text-right text-[#333] hover:text-[#2dd4bf] transition-colors"
      >
        {shortAddress(trade.maker, 3)}
      </a>

      {/* Age */}
      <span className="w-[34px] text-right text-[#333]">{timeAgo(trade.timestamp)}</span>
    </div>
  );
}

export function TradeHistory({ hideHeader }: { hideHeader?: boolean } = {}) {
  const { activeToken, trades, addTrade, clearTrades } = useTradingStore();
  const unsubRef   = useRef<(() => void) | null>(null);
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const seenIds    = useRef<Set<string>>(new Set());

  const pollTrades = useCallback(async (token: string) => {
    try {
      const res = await fetch(`/api/trades/${token}`);
      if (!res.ok) return;
      const data  = await res.json();
      const fresh: Trade[] = (data.trades ?? []).filter((t: Trade) => !seenIds.current.has(t.id));
      fresh.forEach((t) => seenIds.current.add(t.id));
      if (fresh.length) fresh.forEach((t) => addTrade(t));
    } catch { /* silent */ }
  }, [addTrade]);

  useEffect(() => {
    if (!activeToken) return;
    seenIds.current.clear();
    setWsConnected(false);
    unsubRef.current?.();
    if (pollRef.current) clearInterval(pollRef.current);

    pollTrades(activeToken);

    unsubRef.current = subscribeToTrades(
      activeToken,
      (trade) => {
        if (!seenIds.current.has(trade.id)) {
          seenIds.current.add(trade.id);
          addTrade(trade);
          setWsConnected(true);
        }
      },
      () => {
        setWsConnected(false);
        if (!pollRef.current) {
          pollRef.current = setInterval(() => pollTrades(activeToken), 4000);
        }
      },
    );

    return () => {
      unsubRef.current?.();
      unsubRef.current = null;
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeToken, addTrade, clearTrades, pollTrades]);

  // max USD in visible trades — used to scale volume bars
  const maxVol = trades.reduce((m, t) => Math.max(m, t.amountUsd), 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#050505]">
      {/* Header */}
      {!hideHeader && (
        <div className="flex items-center justify-between px-3 h-7 border-b border-[#111] shrink-0">
          <div className="flex items-center gap-1.5">
            <span className={cn("w-1.5 h-1.5 rounded-full", wsConnected ? "bg-[#2dd4bf] animate-pulse" : "bg-[#555]")} />
            <span className="text-[10px] text-[#555] uppercase tracking-wider">Trades</span>
          </div>
          <span className="text-[10px] text-[#333] font-mono">{trades.length}</span>
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-0 px-2 h-6 border-b border-[#111] shrink-0 bg-[#050505]">
        <span className="w-7 shrink-0 text-[9px] text-[#333] uppercase">S</span>
        <span className="flex-1 text-[9px] text-[#333] uppercase">Price</span>
        <span className="w-[68px] text-right text-[9px] text-[#333] uppercase">Tokens</span>
        <span className="w-[60px] text-right text-[9px] text-[#333] uppercase">USD</span>
        <span className="w-[52px] text-right text-[9px] text-[#333] uppercase">Wallet</span>
        <span className="w-[34px] text-right text-[9px] text-[#333] uppercase">Age</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        {!activeToken && (
          <div className="flex items-center justify-center h-20 text-[#333] text-xs">Select a token</div>
        )}
        {activeToken && trades.length === 0 && (
          <div className="flex items-center justify-center h-20 gap-2 text-[#333] text-xs">
            <Spinner size={14} /> Loading…
          </div>
        )}
        {trades.map((t) => <TradeRow key={t.id} trade={t} maxVol={maxVol} />)}
      </div>
    </div>
  );
}
