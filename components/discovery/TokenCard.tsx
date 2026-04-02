"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NewToken } from "@/types";
import { formatPrice, formatUsd, formatPct, formatAmount, timeAgo, shortAddress } from "@/lib/utils";
import { cn, rugScoreColor } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { Shield, Skull, TrendingUp, TrendingDown, Users, BarChart2, ExternalLink, Flame, AlertTriangle, Pin, PinOff } from "lucide-react";

interface Props {
  token: NewToken;
  onSelect?: (token: NewToken) => void;
  pinned?: boolean;
  onPin?: (address: string) => void;
}

export function TokenCard({ token, onSelect, pinned = false, onPin }: Props) {
  const isPos5m = token.priceChange5m >= 0;
  const isPos1h = token.priceChange1h >= 0;
  const [imgSrc, setImgSrc] = useState<string | null>(token.logoUri ?? null);

  useEffect(() => {
    // logoUri is a direct image URL (DexScreener / GeckoTerminal) — no proxy needed
    if (token.logoUri) { setImgSrc(token.logoUri); return; }
    if (!token.metaUri) return;
    const ctrl = new AbortController();
    fetch(`/api/proxy-meta?url=${encodeURIComponent(token.metaUri)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((meta) => {
        if (meta?.image && typeof meta.image === "string") setImgSrc(meta.image);
      })
      .catch(() => {});
    return () => ctrl.abort();
  }, [token.metaUri, token.logoUri]);

  // Derived signals
  const buyPct  = token.buyPressurePct ?? 50;
  const sellPct = 100 - buyPct;
  const hasBuySurge  = buyPct >= 70;
  const hasSellSurge = sellPct >= 70;
  const washHigh     = (token.washScore ?? 0) >= 40;
  const bcPct        = token.bondingCurveProgress ?? 0;
  const nearGrad     = bcPct >= 70 || token.nearGraduation;

  // Simple rule-based signal badge (no AI calls per-card)
  const signal =
    hasBuySurge  && (token.priceChange5m ?? 0) > 3  ? "bull" :
    hasSellSurge && (token.priceChange5m ?? 0) < -3  ? "bear" :
    null;

  return (
    <div
      className={cn(
        "group bg-[#0d1117] border rounded-lg p-3 cursor-pointer transition-all hover:border-[#30363d] relative",
        pinned
          ? "border-[#58a6ff]/50 hover:border-[#58a6ff]/80"
          : token.unscanned || token.rugScore < 40
          ? "border-[#3d1a1a] hover:border-[#f85149]/40"
          : nearGrad
          ? "border-[#d29922]/40 hover:border-[#d29922]/70"
          : "border-[#21262d]"
      )}
      onClick={() => onSelect?.(token)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[#1e2530] border border-[#30363d] flex items-center justify-center shrink-0 overflow-hidden text-xs font-bold text-[#58a6ff]">
            {imgSrc ? (
              <img src={imgSrc} alt={token.symbol} className="w-full h-full object-cover" onError={() => setImgSrc(null)} />
            ) : (
              token.symbol.slice(0, 2)
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-bold text-sm text-[#e6edf3] truncate">{token.symbol}</span>
              {token.graduated && <Badge variant="blue" className="text-[9px] px-1">Grad</Badge>}
              {nearGrad && !token.graduated && (
                <span className="text-[9px] px-1 py-0 rounded bg-[#3d2f0a] border border-[#d29922]/40 text-[#d29922] font-bold">
                  🔥 Near Grad
                </span>
              )}
              {signal === "bull" && (
                <span className="text-[9px] px-1 py-0 rounded bg-[#1a3826] border border-[#3fb950]/30 text-[#3fb950]">
                  Bullish
                </span>
              )}
              {signal === "bear" && (
                <span className="text-[9px] px-1 py-0 rounded bg-[#3d1a1a] border border-[#f85149]/30 text-[#f85149]">
                  Bearish
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#8b949e] truncate">{token.name}</p>
          </div>
        </div>

        {/* Rug Score / Unscanned badge */}
        <Link
          href={`/rug-analysis/${token.address}`}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] hover:border-[#484f58] shrink-0"
        >
          {token.unscanned ? (
            <><Skull size={10} className="text-[#f85149]" /><span className="text-[10px] font-bold text-[#f85149]">?</span></>
          ) : (
            <><Shield size={10} className={rugScoreColor(token.rugScore)} />
              <span className={cn("text-[10px] font-bold", rugScoreColor(token.rugScore))}>{token.rugScore}</span></>
          )}
        </Link>
      </div>

      {/* Price row: current + 5m + 1h */}
      <div className="flex items-end justify-between mb-2">
        <div>
          <p className="text-[10px] text-[#484f58]">Price</p>
          <p className="text-base font-mono font-bold text-[#e6edf3]">
            {token.currentPrice > 0
              ? formatPrice(token.currentPrice)
              : <span className="text-[#484f58] text-sm">—</span>}
          </p>
        </div>
        {token.currentPrice > 0 && (
          <div className="flex gap-2 text-right">
            <div>
              <p className="text-[10px] text-[#484f58]">5m</p>
              <div className={cn("flex items-center gap-0.5 text-sm font-mono font-semibold", isPos5m ? "text-[#3fb950]" : "text-[#f85149]")}>
                {isPos5m ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {formatPct(token.priceChange5m)}
              </div>
            </div>
            {token.priceChange1h !== 0 && (
              <div>
                <p className="text-[10px] text-[#484f58]">1h</p>
                <div className={cn("flex items-center gap-0.5 text-sm font-mono font-semibold", isPos1h ? "text-[#3fb950]" : "text-[#f85149]")}>
                  {isPos1h ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {formatPct(token.priceChange1h)}
                </div>
              </div>
            )}
          </div>
        )}
        {!token.currentPrice && (
          <span className="text-[#484f58] text-[10px]">loading…</span>
        )}
      </div>

      {/* Buy / Sell pressure bar */}
      {token.currentPrice > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="text-[#3fb950]">Buy {buyPct}%</span>
            <span className="text-[#f85149]">{sellPct}% Sell</span>
          </div>
          <div className="h-1.5 rounded-full bg-[#f85149]/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#3fb950] transition-all"
              style={{ width: `${buyPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Bonding curve progress bar (pump.fun only) */}
      {!token.graduated && bcPct > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[9px] mb-0.5">
            <span className="flex items-center gap-0.5 text-[#484f58]">
              <Flame size={8} />Bonding curve
            </span>
            <span className={cn("font-mono font-semibold", bcPct >= 80 ? "text-[#d29922]" : "text-[#484f58]")}>
              {bcPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-1 rounded-full bg-[#21262d] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all",
                bcPct >= 80 ? "bg-[#d29922]" : bcPct >= 50 ? "bg-[#58a6ff]" : "bg-[#30363d]"
              )}
              style={{ width: `${bcPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        <div>
          <p className="text-[#484f58]">Vol 24h</p>
          <p className="font-mono">
            {token.volume24h > 0
              ? <span className="text-[#8b949e]">{formatUsd(token.volume24h)}</span>
              : <span className="text-[#484f58]">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[#484f58]">Mkt Cap</p>
          <p className="font-mono">
            {token.marketCap > 0
              ? <span className="text-[#8b949e]">{formatUsd(token.marketCap)}</span>
              : <span className="text-[#484f58]">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[#484f58] flex items-center gap-0.5"><Users size={8} />Holders</p>
          <p className="font-mono">
            {token.holders > 0
              ? <span className="text-[#8b949e]">{formatAmount(token.holders)}</span>
              : <span className="text-[#484f58]">—</span>}
          </p>
        </div>
        <div>
          <p className="text-[#484f58] flex items-center gap-0.5"><BarChart2 size={8} />Trades</p>
          <p className="font-mono">
            {token.trades > 0
              ? <span className="text-[#8b949e]">{formatAmount(token.trades)}</span>
              : <span className="text-[#484f58]">—</span>}
          </p>
        </div>
      </div>

      {/* Wash score warning badge */}
      {washHigh && (
        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-[#d29922]">
          <AlertTriangle size={9} />
          <span>Wash score {token.washScore}/100 — suspicious trading pattern</span>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-[#161b22]">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#484f58] font-mono">{shortAddress(token.address, 4)}</span>
          {token.dex && token.dex !== "pump.fun" && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#8b949e]">
              {token.dex}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[#484f58]">{timeAgo(token.createdAt)}</span>
          {onPin && (
            <button
              onClick={(e) => { e.stopPropagation(); onPin(token.address); }}
              className={cn(
                "flex items-center p-0.5 rounded transition-colors",
                pinned ? "text-[#58a6ff] hover:text-[#79b8ff]" : "text-[#484f58] hover:text-[#58a6ff]"
              )}
              title={pinned ? "Unpin" : "Pin to top"}
            >
              {pinned ? <PinOff size={11} /> : <Pin size={11} />}
            </button>
          )}
          <Link
            href={`/terminal/${token.address}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-0.5 text-[10px] text-[#58a6ff] hover:text-[#79b8ff] transition-colors"
          >
            Trade <ExternalLink size={9} />
          </Link>
        </div>
      </div>

      {/* Risk warnings */}
      {token.unscanned ? (
        <div className="mt-2 px-2 py-1 bg-[#2d2200] border border-[#d29922]/20 rounded text-[10px] text-[#d29922] font-medium">
          ⚠ New launch — unscanned, trade with caution
        </div>
      ) : token.rugScore < 40 ? (
        <div className="mt-2 px-2 py-1 bg-[#3d1a1a] rounded text-[10px] text-[#f85149] font-medium">
          ⚠ High rug risk detected — check analysis before trading
        </div>
      ) : null}
    </div>
  );
}
