"use client";

import { useEffect, useState, useCallback } from "react";
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle } from "lucide-react";
import { AITradingSignal } from "@/lib/ai/deepseek";

interface Props {
  tokenAddress: string;
  symbol: string;
  rugScore: number;
  holders: number;
}

const ACTION_CONFIG: Record<
  AITradingSignal["action"],
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  STRONG_BUY:  { label: "STRONG BUY",  color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", icon: <TrendingUp size={14} /> },
  BUY:         { label: "BUY",         color: "text-green-400",   bg: "bg-green-400/10 border-green-400/30",     icon: <TrendingUp size={14} /> },
  HOLD:        { label: "HOLD",        color: "text-yellow-400",  bg: "bg-yellow-400/10 border-yellow-400/30",   icon: <Minus size={14} /> },
  SELL:        { label: "SELL",        color: "text-orange-400",  bg: "bg-orange-400/10 border-orange-400/30",   icon: <TrendingDown size={14} /> },
  STRONG_SELL: { label: "STRONG SELL", color: "text-red-400",     bg: "bg-red-400/10 border-red-400/30",         icon: <TrendingDown size={14} /> },
};

export default function AISignalWidget({ tokenAddress, symbol, rugScore, holders }: Props) {
  const [signal, setSignal] = useState<AITradingSignal | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchSignal = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        symbol,
        rugScore: rugScore.toString(),
        holders: holders.toString(),
      });
      const res = await fetch(`/api/ai-signal/${tokenAddress}?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: AITradingSignal = await res.json();
      setSignal(data);
      setLastFetched(new Date());
    } catch (err) {
      setError("Signal unavailable");
      console.error("[AISignalWidget]", err);
    } finally {
      setLoading(false);
    }
  }, [tokenAddress, symbol, rugScore, holders]);

  // Fetch on mount and every 3 minutes
  useEffect(() => {
    fetchSignal();
    const interval = setInterval(fetchSignal, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSignal]);

  const cfg = signal ? ACTION_CONFIG[signal.action] : null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--muted)]">
          <Brain size={13} className="text-purple-400" />
          <span>Blockforecast AI Signal</span>
        </div>
        <button
          onClick={fetchSignal}
          disabled={loading}
          className="text-[var(--muted)] hover:text-white transition-colors disabled:opacity-40"
          title="Refresh signal"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Loading */}
      {loading && !signal && (
        <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
          <RefreshCw size={11} className="animate-spin" />
          Analyzing market data…
        </div>
      )}

      {/* Error */}
      {error && !signal && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertTriangle size={12} />
          {error}
        </div>
      )}

      {/* Signal */}
      {signal && cfg && (
        <div className="space-y-2">
          {/* Action badge + confidence */}
          <div className={`flex items-center justify-between rounded-md border px-2.5 py-1.5 ${cfg.bg}`}>
            <div className={`flex items-center gap-1.5 font-bold text-sm ${cfg.color}`}>
              {cfg.icon}
              {cfg.label}
            </div>
            <div className="text-xs text-[var(--muted)]">
              {signal.confidence}% confidence
            </div>
          </div>

          {/* Rationale */}
          <p className="text-xs text-[var(--muted)] leading-relaxed">{signal.rationale}</p>

          {/* Levels */}
          {(signal.entryPrice || signal.targetPrice || signal.stopLoss) && (
            <div className="grid grid-cols-3 gap-1.5 text-xs">
              {signal.entryPrice && (
                <div className="rounded bg-[var(--background)] px-2 py-1 text-center">
                  <div className="text-[var(--muted)] text-[10px]">Entry</div>
                  <div className="text-white font-mono">${signal.entryPrice.toFixed(8)}</div>
                </div>
              )}
              {signal.targetPrice && (
                <div className="rounded bg-[var(--background)] px-2 py-1 text-center">
                  <div className="text-[var(--muted)] text-[10px]">Target</div>
                  <div className="text-emerald-400 font-mono">${signal.targetPrice.toFixed(8)}</div>
                </div>
              )}
              {signal.stopLoss && (
                <div className="rounded bg-[var(--background)] px-2 py-1 text-center">
                  <div className="text-[var(--muted)] text-[10px]">Stop</div>
                  <div className="text-red-400 font-mono">${signal.stopLoss.toFixed(8)}</div>
                </div>
              )}
            </div>
          )}

          {/* Timeframe + timestamp */}
          <div className="flex items-center justify-between text-[10px] text-[var(--muted)]">
            <span>Timeframe: {signal.timeframe}</span>
            {lastFetched && (
              <span>{lastFetched.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
