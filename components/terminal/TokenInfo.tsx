"use client";

import React from "react";
import Link from "next/link";
import { useTradingStore } from "@/store/tradingStore";
import { formatPrice, formatUsd, formatPct, formatAmount, shortAddress } from "@/lib/utils";
import { cn, rugScoreColor } from "@/lib/utils";
import { ExternalLink, Copy, CheckCircle2, Shield } from "lucide-react";

export function TokenInfo() {
  const { activeTokenMeta, livePrice, priceChange } = useTradingStore();
  const [copied, setCopied] = React.useState(false);

  if (!activeTokenMeta) {
    return <div className="h-9 border-b border-[#111] flex items-center px-4 text-[#333] text-xs">No token selected</div>;
  }

  const t          = activeTokenMeta;
  const price      = livePrice || t.currentPrice;
  const change     = priceChange || t.priceChange5m;
  const SUPPLY     = 1_000_000_000;
  const liveMktCap = price > 0 ? price * SUPPLY : t.marketCap;
  const isUp       = change >= 0;

  const handleCopy = () => {
    navigator.clipboard.writeText(t.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="h-9 shrink-0 border-b border-[#111] flex items-center px-3 gap-4 text-[11px] font-mono bg-[#050505] overflow-x-auto scrollbar-none">
      {/* Symbol + name */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-5 h-5 rounded-full bg-[#111] flex items-center justify-center">
          <span className="text-[8px] font-bold text-[#2dd4bf]">{t.symbol.slice(0, 2)}</span>
        </div>
        <span className="font-bold text-[#e6edf3] text-[12px]">{t.symbol}</span>
        <span className="text-[#444] hidden sm:inline">{t.name}</span>
      </div>

      <div className="w-px h-4 bg-[#1a1a1a] shrink-0" />

      {/* Address */}
      <button onClick={handleCopy} className="flex items-center gap-1 text-[#444] hover:text-[#666] transition-colors shrink-0">
        {shortAddress(t.address, 4)}
        {copied ? <CheckCircle2 size={9} className="text-[#2dd4bf]" /> : <Copy size={9} />}
      </button>
      <a href={`https://solscan.io/token/${t.address}`} target="_blank" rel="noopener noreferrer"
        className="text-[#333] hover:text-[#2dd4bf] transition-colors shrink-0">
        <ExternalLink size={10} />
      </a>

      <div className="w-px h-4 bg-[#1a1a1a] shrink-0" />

      {/* Price */}
      <span className="text-[#e6edf3] font-bold text-[13px] shrink-0">{formatPrice(price)}</span>

      {/* Change */}
      <span className={cn("shrink-0 font-semibold", isUp ? "text-[#2dd4bf]" : "text-[#fb7185]")}>
        {formatPct(change)}
      </span>
      <span className="text-[#333] shrink-0">5m</span>
      <span className={cn("shrink-0", t.priceChange1h >= 0 ? "text-[#2dd4bf]" : "text-[#fb7185]")}>
        {formatPct(t.priceChange1h)}
      </span>
      <span className="text-[#333] shrink-0">1h</span>

      <div className="w-px h-4 bg-[#1a1a1a] shrink-0" />

      {/* Stats */}
      <span className="text-[#555] shrink-0">MCap</span>
      <span className="text-[#e6edf3] shrink-0">{formatUsd(liveMktCap)}</span>

      <span className="text-[#555] shrink-0">Vol</span>
      <span className="text-[#e6edf3] shrink-0">{formatUsd(t.volume24h)}</span>

      <span className="text-[#555] shrink-0">Holders</span>
      <span className="text-[#e6edf3] shrink-0">{formatAmount(t.holders)}</span>

      <span className="text-[#555] shrink-0">Trades</span>
      <span className="text-[#e6edf3] shrink-0">{formatAmount(t.trades)}</span>

      <div className="w-px h-4 bg-[#1a1a1a] shrink-0" />

      {/* Rug score */}
      <Link href={`/rug-analysis/${t.address}`}
        className="flex items-center gap-1 hover:text-[#e6edf3] transition-colors shrink-0">
        <Shield size={10} className={rugScoreColor(t.rugScore)} />
        <span className={cn("font-bold", rugScoreColor(t.rugScore))}>{t.rugScore}</span>
        <span className="text-[#333]">/ 100</span>
      </Link>
    </div>
  );
}
