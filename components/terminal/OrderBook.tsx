"use client";

import React, { useEffect, useMemo } from "react";
import { useTradingStore } from "@/store/tradingStore";
import { Trade } from "@/types";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/ui";

// Build a simulated order book from recent trades
function buildOrderBook(trades: Trade[]) {
  const bidMap = new Map<number, number>();
  const askMap = new Map<number, number>();

  for (const trade of trades.slice(0, 100)) {
    const rounded = parseFloat(trade.priceUsd.toPrecision(5));
    const usd = Number(trade.amountUsd) || 0;
    if (trade.side === "buy") {
      bidMap.set(rounded, (bidMap.get(rounded) || 0) + usd);
    } else {
      askMap.set(rounded, (askMap.get(rounded) || 0) + usd);
    }
  }

  const bids = Array.from(bidMap.entries())
    .sort(([a], [b]) => b - a)
    .slice(0, 15);
  const asks = Array.from(askMap.entries())
    .sort(([a], [b]) => a - b)
    .slice(0, 15);

  const maxBid = Math.max(...bids.map(([, v]) => v), 1);
  const maxAsk = Math.max(...asks.map(([, v]) => v), 1);

  let bidTotal = 0;
  let askTotal = 0;

  return {
    bids: bids.map(([price, size]) => {
      bidTotal += size;
      return { price, size, total: bidTotal, depth: size / maxBid };
    }),
    asks: asks.map(([price, size]) => {
      askTotal += size;
      return { price, size, total: askTotal, depth: size / maxAsk };
    }),
    spread:
      asks[0] && bids[0] ? asks[0][0] - bids[0][0] : 0,
    midPrice: asks[0] && bids[0] ? (asks[0][0] + bids[0][0]) / 2 : 0,
  };
}

function formatSize(size: number): string {
  const n = Number(size) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

export function OrderBook() {
  const { trades, livePrice } = useTradingStore();

  const { bids, asks, spread, midPrice } = useMemo(
    () => buildOrderBook(trades),
    [trades]
  );

  const spreadPct = midPrice > 0 ? (spread / midPrice) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
      <SectionHeader title="Order Book" />

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] text-[#484f58] font-mono border-b border-[#21262d] bg-[#080b12]">
        <span>PRICE (USD)</span>
        <span className="text-center">SIZE ($)</span>
        <span className="text-right">TOTAL ($)</span>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Asks (sells) - top half, reversed so lowest ask is nearest spread */}
        <div className="flex-1 overflow-y-auto flex flex-col-reverse">
          {asks.map(({ price, size, total, depth }) => (
            <div key={`ask-${price}`} className="relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono hover:bg-[#161b22] group">
              <div
                className="absolute inset-y-0 right-0 bg-[#f85149]/8 transition-all"
                style={{ width: `${depth * 100}%` }}
              />
              <span className="text-[#f85149] z-10">{formatPrice(price)}</span>
              <span className="text-center text-[#8b949e] z-10">{formatSize(size)}</span>
              <span className="text-right text-[#484f58] z-10">{formatSize(total)}</span>
            </div>
          ))}
        </div>

        {/* Spread indicator */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-[#161b22] border-y border-[#21262d]">
          <span className="text-xs font-bold text-[#e6edf3] font-mono">
            {formatPrice(livePrice || midPrice)}
          </span>
          <span className="text-[10px] text-[#484f58]">
            Spread: {formatPrice(spread)} ({spreadPct.toFixed(3)}%)
          </span>
        </div>

        {/* Bids (buys) - bottom half */}
        <div className="flex-1 overflow-y-auto">
          {bids.map(({ price, size, total, depth }) => (
            <div key={`bid-${price}`} className="relative grid grid-cols-3 px-3 py-0.5 text-[11px] font-mono hover:bg-[#161b22]">
              <div
                className="absolute inset-y-0 right-0 bg-[#3fb950]/8 transition-all"
                style={{ width: `${depth * 100}%` }}
              />
              <span className="text-[#3fb950] z-10">{formatPrice(price)}</span>
              <span className="text-center text-[#8b949e] z-10">{formatSize(size)}</span>
              <span className="text-right text-[#484f58] z-10">{formatSize(total)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
