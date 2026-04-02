"use client";

import Link            from "next/link";
import { Clock, TrendingUp, Shield, Zap, HelpCircle } from "lucide-react";
import { OddsBar }     from "./OddsBar";
import { Market }      from "@/lib/prediction/types";
import { timeAgo }     from "@/lib/utils";
import { cn }          from "@/lib/utils";

const CATEGORY_META = {
  price:      { label: "Price",      icon: TrendingUp, color: "text-[#58a6ff]"  },
  rug:        { label: "Rug",        icon: Shield,     color: "text-[#f85149]"  },
  graduation: { label: "Grad",       icon: Zap,        color: "text-[#d29922]"  },
  custom:     { label: "Custom",     icon: HelpCircle, color: "text-[#8b949e]"  },
};

const STATUS_BADGE = {
  open:      "bg-[#1a2d1a] text-[#3fb950] border border-[#238636]",
  resolved:  "bg-[#1a1a2d] text-[#58a6ff] border border-[#1f6feb]",
  cancelled: "bg-[#2d1a1a] text-[#8b949e] border border-[#30363d]",
};

interface MarketCardProps {
  market: Market;
}

export function MarketCard({ market }: MarketCardProps) {
  const meta      = CATEGORY_META[market.category] ?? CATEGORY_META.custom;
  const Icon      = meta.icon;
  const expired   = new Date() > new Date(market.endTime) && market.status === "open";
  const totalPool = market.yesPool + market.noPool;

  return (
    <Link href={`/markets/${market.id}`}>
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 hover:border-[#30363d] hover:bg-[#161b22] transition-all cursor-pointer group">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <Icon size={12} className={meta.color} />
            <span className={cn("text-[10px] font-medium", meta.color)}>{meta.label}</span>
          </div>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono", STATUS_BADGE[market.status])}>
            {market.status === "open" && expired ? "ENDED" : market.status.toUpperCase()}
          </span>
        </div>

        {/* Question */}
        <p className="text-[13px] text-[#e6edf3] font-medium leading-snug mb-3 group-hover:text-white transition-colors line-clamp-2">
          {market.question}
        </p>

        {/* Token badge */}
        {market.tokenSymbol && (
          <div className="flex items-center gap-1 mb-3">
            <span className="text-[10px] bg-[#1e2530] text-[#58a6ff] px-2 py-0.5 rounded font-mono">
              ${market.tokenSymbol}
            </span>
          </div>
        )}

        {/* Odds */}
        <OddsBar yesPool={market.yesPool} noPool={market.noPool} size="sm" />

        {/* Footer */}
        <div className="flex justify-between items-center mt-3 text-[10px] text-[#8b949e]">
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span>{market.status === "open" ? `ends ${timeAgo(market.endTime)} ago` : `resolved ${market.resolveTime ? timeAgo(market.resolveTime) + " ago" : ""}`}</span>
          </div>
          <span className="font-mono">{market.totalBets} bets · {totalPool.toFixed(2)} SOL</span>
        </div>

        {/* Resolved outcome */}
        {market.status === "resolved" && market.outcome && (
          <div className={cn(
            "mt-2 text-center text-[11px] font-bold py-1 rounded",
            market.outcome === "yes" ? "bg-[#1a2d1a] text-[#3fb950]" : "bg-[#2d1a1a] text-[#f85149]",
          )}>
            RESOLVED: {market.outcome.toUpperCase()}
          </div>
        )}
      </div>
    </Link>
  );
}
