"use client";

import React from "react";
import { RugCheckResult } from "@/types";
import { cn, formatPct, shortAddress, rugScoreColor, rugScoreLabel } from "@/lib/utils";
import { Badge, Card, Divider } from "@/components/ui";
import {
  Shield, AlertTriangle, CheckCircle2, XCircle,
  Users, RefreshCw, Activity, TrendingUp, ExternalLink
} from "lucide-react";

interface Props {
  result: RugCheckResult;
}

function ScoreRing({ score }: { score: number }) {
  const r = 30;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 80 ? "#3fb950" :
    score >= 60 ? "#d29922" :
    score >= 40 ? "#e3b341" :
    "#f85149";

  return (
    <div className="relative w-20 h-20 flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#21262d" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none"
          stroke={color} strokeWidth="6"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold font-mono" style={{ color }}>{score}</span>
        <span className="text-[8px] text-[#484f58]">/100</span>
      </div>
    </div>
  );
}

function Flag({ text, type }: { text: string; type: "warning" | "danger" | "ok" }) {
  const styles = {
    warning: "bg-[#3d2f0a] text-[#d29922] border-[#5c4515]",
    danger: "bg-[#3d1a1a] text-[#f85149] border-[#6b2929]",
    ok: "bg-[#1a3826] text-[#3fb950] border-[#2a5c3a]",
  };
  const Icon = type === "ok" ? CheckCircle2 : type === "danger" ? XCircle : AlertTriangle;
  return (
    <div className={cn("flex items-start gap-2 px-3 py-2 rounded border text-xs", styles[type])}>
      <Icon size={12} className="mt-0.5 shrink-0" />
      {text}
    </div>
  );
}

function HolderBar({ holder, index }: { holder: RugCheckResult["holders"][0]; index: number }) {
  const barColor =
    holder.percentage > 20 ? "#f85149" :
    holder.percentage > 10 ? "#d29922" :
    "#3fb950";

  return (
    <div className="flex items-center gap-2 py-1.5 text-[11px] font-mono border-b border-[#161b22]">
      <span className="w-5 text-[#484f58] shrink-0">#{index + 1}</span>
      <a
        href={`https://solscan.io/account/${holder.address}`}
        target="_blank"
        rel="noopener noreferrer"
        className="w-24 text-[#8b949e] hover:text-[#58a6ff] transition-colors flex items-center gap-1 shrink-0"
      >
        {shortAddress(holder.address, 4)}
        <ExternalLink size={8} />
      </a>
      {holder.isCreator && (
        <Badge variant="yellow" className="text-[9px] px-1 py-0">Dev</Badge>
      )}
      <div className="flex-1 bg-[#161b22] rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(holder.percentage, 100)}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="w-12 text-right" style={{ color: barColor }}>
        {holder.percentage.toFixed(2)}%
      </span>
    </div>
  );
}

export function RugAnalysisPanel({ result }: Props) {
  const riskBadge: Record<string, { variant: "green" | "yellow" | "red"; label: string }> = {
    safe: { variant: "green", label: "SAFE" },
    low: { variant: "green", label: "LOW RISK" },
    medium: { variant: "yellow", label: "MEDIUM RISK" },
    high: { variant: "red", label: "HIGH RISK" },
    rug: { variant: "red", label: "LIKELY RUG" },
  };
  const badge = riskBadge[result.riskLevel];

  return (
    <div className="space-y-4">
      {/* Hero score card */}
      <Card className="p-4">
        <div className="flex items-center gap-6 flex-wrap">
          <ScoreRing score={result.overallScore} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Shield size={16} className={rugScoreColor(result.overallScore)} />
              <span className={cn("text-lg font-bold", rugScoreColor(result.overallScore))}>
                {rugScoreLabel(result.overallScore)}
              </span>
              <Badge variant={badge.variant}>{badge.label}</Badge>
              {result.graduated && <Badge variant="blue">Graduated ✓</Badge>}
            </div>
            <p className="text-sm text-[#8b949e]">
              {result.tokenName} ({result.tokenSymbol})
            </p>
            <p className="text-xs text-[#484f58] font-mono mt-0.5">
              {result.tokenAddress}
            </p>
            <p className="text-[10px] text-[#484f58] mt-1">
              Analyzed at {new Date(result.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Risk Flags */}
      {result.flags.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
            Risk Flags ({result.flags.length})
          </h3>
          {result.flags.map((flag, i) => (
            <Flag
              key={i}
              text={flag}
              type={
                result.overallScore < 40 ? "danger" :
                result.overallScore < 70 ? "warning" :
                "ok"
              }
            />
          ))}
          {result.flags.length === 0 && (
            <Flag text="No significant risk flags detected" type="ok" />
          )}
        </div>
      )}

      {/* Key Metrics */}
      <Card className="divide-y divide-[#21262d]">
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <Users size={12} /> Creator Holding
          </span>
          <span className={cn("text-sm font-mono font-bold",
            result.creatorHoldingPct > 20 ? "text-[#f85149]" :
            result.creatorHoldingPct > 10 ? "text-[#d29922]" :
            "text-[#3fb950]"
          )}>
            {result.creatorHoldingPct.toFixed(2)}%
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <Users size={12} /> Top 10 Holders
          </span>
          <span className={cn("text-sm font-mono font-bold",
            result.top10HoldersPct > 80 ? "text-[#f85149]" :
            result.top10HoldersPct > 60 ? "text-[#d29922]" :
            "text-[#3fb950]"
          )}>
            {result.top10HoldersPct.toFixed(2)}%
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <AlertTriangle size={12} /> Pre-Distribution
          </span>
          <span className={result.preDistributed ? "text-[#f85149] text-sm font-bold" : "text-[#3fb950] text-sm"}>
            {result.preDistributed ? "Detected ⚠" : "Clean ✓"}
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <Activity size={12} /> Wash Trading Score
          </span>
          <span className={cn("text-sm font-mono font-bold",
            result.washTrading.score > 60 ? "text-[#f85149]" :
            result.washTrading.score > 30 ? "text-[#d29922]" :
            "text-[#3fb950]"
          )}>
            {result.washTrading.score.toFixed(0)}/100
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <RefreshCw size={12} /> Self-Trades
          </span>
          <span className={result.washTrading.selfTradeCount > 0 ? "text-[#f85149] text-sm font-bold" : "text-[#3fb950] text-sm"}>
            {result.washTrading.selfTradeCount} detected
          </span>
        </div>
        <div className="px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs text-[#8b949e] flex items-center gap-1.5">
            <TrendingUp size={12} /> Graduated
          </span>
          <span className={result.graduated ? "text-[#3fb950] text-sm" : "text-[#8b949e] text-sm"}>
            {result.graduated ? "Yes ✓" : "No (Bonding Curve)"}
          </span>
        </div>
        {!result.graduated && result.liquidity.currentLiquidity > 0 && (
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[#8b949e]">Bonding Curve Progress</span>
              <span className="text-xs font-mono text-[#58a6ff]">
                {result.liquidity.currentLiquidity.toFixed(2)} / 85 SOL
              </span>
            </div>
            <div className="bg-[#161b22] rounded-full h-2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min((result.liquidity.currentLiquidity / 85) * 100, 100)}%`,
                  background: "linear-gradient(90deg, #1d4ed8, #58a6ff)",
                }}
              />
            </div>
            <p className="text-[10px] text-[#484f58] mt-0.5 text-right">
              {Math.min(((result.liquidity.currentLiquidity / 85) * 100), 100).toFixed(1)}% to Raydium
            </p>
          </div>
        )}
      </Card>

      {/* Holder Distribution */}
      <div>
        <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">
          Top Holders
        </h3>
        <Card className="overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-[#484f58] bg-[#080b12] border-b border-[#21262d]">
            <span className="w-5">#</span>
            <span className="w-24">Address</span>
            <span className="flex-1">Distribution</span>
            <span className="w-12 text-right">%</span>
          </div>
          {result.holders.slice(0, 15).map((h, i) => (
            <HolderBar key={h.address} holder={h} index={i} />
          ))}
          {result.holders.length === 0 && (
            <p className="text-center text-[#484f58] text-xs py-4">No holder data available</p>
          )}
        </Card>
      </div>

      {/* Wash Trading Details */}
      {result.washTrading.suspiciousWallets.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider mb-2">
            Suspicious Wallets ({result.washTrading.suspiciousWallets.length})
          </h3>
          <Card className="p-3 space-y-1.5">
            {result.washTrading.suspiciousWallets.map((w) => (
              <div key={w} className="flex items-center justify-between">
                <a
                  href={`https://solscan.io/account/${w}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-[#8b949e] hover:text-[#58a6ff] flex items-center gap-1"
                >
                  {shortAddress(w, 6)} <ExternalLink size={9} />
                </a>
                <Badge variant="red" className="text-[9px]">High Activity</Badge>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
