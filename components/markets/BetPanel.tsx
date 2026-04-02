"use client";

import { useState, useCallback } from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { Market }  from "@/lib/prediction/types";
import { cn }      from "@/lib/utils";

interface BetPanelProps {
  market:       Market;
  walletAddress: string | null;
  onBetPlaced:  () => void;
}

export function BetPanel({ market, walletAddress, onBetPlaced }: BetPanelProps) {
  const [side,    setSide]    = useState<"yes" | "no">("yes");
  const [amount,  setAmount]  = useState("0.1");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [success, setSuccess] = useState("");

  const totalPool = market.yesPool + market.noPool;
  const yesOdds   = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noOdds    = 100 - yesOdds;

  // Estimated payout = your stake / (winning pool + your stake) * total new pool * (1 - fee)
  const estPayout = useCallback(() => {
    const stake  = Number(amount) || 0;
    const winP   = side === "yes" ? market.yesPool : market.noPool;
    const newWin = winP + stake;
    const total  = totalPool + stake;
    if (newWin === 0) return 0;
    return (stake / newWin) * total * (1 - market.feePct);
  }, [amount, side, market, totalPool]);

  const payout  = estPayout();
  const profit  = payout - Number(amount);
  const isOpen  = market.status === "open" && new Date() <= new Date(market.endTime);

  async function handleBet() {
    if (!walletAddress) { setError("Connect your wallet first"); return; }
    const amt = Number(amount);
    if (!amt || amt < 0.01) { setError("Minimum bet is 0.01 SOL"); return; }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res  = await fetch(`/api/markets/${market.id}/bet`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ bettor: walletAddress, outcome: side, amount: amt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Bet failed");

      setSuccess(`Bet placed! ${amt} SOL on ${side.toUpperCase()}`);
      setAmount("0.1");
      onBetPlaced();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Bet failed");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 text-center text-[13px] text-[#8b949e]">
        {market.status === "resolved"
          ? `Market resolved: ${market.outcome?.toUpperCase()}`
          : market.status === "cancelled"
          ? "Market cancelled — bets refunded"
          : "Betting period has ended"}
      </div>
    );
  }

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 space-y-4">
      <h3 className="text-[13px] font-semibold text-[#e6edf3]">Place Bet</h3>

      {/* Side toggle */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setSide("yes")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            side === "yes"
              ? "bg-[#238636] text-white"
              : "bg-[#161b22] text-[#8b949e] hover:text-[#3fb950] hover:border-[#238636] border border-[#21262d]",
          )}
        >
          <TrendingUp size={14} />
          YES · {yesOdds.toFixed(0)}%
        </button>
        <button
          onClick={() => setSide("no")}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all",
            side === "no"
              ? "bg-[#b91c1c] text-white"
              : "bg-[#161b22] text-[#8b949e] hover:text-[#f85149] hover:border-[#f85149] border border-[#21262d]",
          )}
        >
          <TrendingDown size={14} />
          NO · {noOdds.toFixed(0)}%
        </button>
      </div>

      {/* Amount */}
      <div>
        <label className="text-[11px] text-[#8b949e] mb-1 block">Amount (SOL)</label>
        <div className="flex gap-2">
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] font-mono focus:outline-none focus:border-[#58a6ff]"
          />
          {["0.1", "0.5", "1"].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              className="px-2 py-1 bg-[#21262d] rounded text-[11px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Payout preview */}
      {Number(amount) >= 0.01 && (
        <div className="bg-[#161b22] rounded-lg p-3 space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-[#8b949e]">Potential payout</span>
            <span className="text-[#e6edf3] font-mono">{payout.toFixed(4)} SOL</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#8b949e]">Profit if correct</span>
            <span className={cn("font-mono", profit >= 0 ? "text-[#3fb950]" : "text-[#f85149]")}>
              {profit >= 0 ? "+" : ""}{profit.toFixed(4)} SOL
            </span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-[#8b949e]">Platform fee</span>
            <span className="text-[#8b949e] font-mono">{(market.feePct * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Feedback */}
      {error   && <p className="text-[12px] text-[#f85149]">{error}</p>}
      {success && <p className="text-[12px] text-[#3fb950]">{success}</p>}

      {/* Submit */}
      <button
        onClick={handleBet}
        disabled={loading || !walletAddress}
        className={cn(
          "w-full py-2.5 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2",
          side === "yes"
            ? "bg-[#238636] hover:bg-[#2ea043] text-white disabled:opacity-50"
            : "bg-[#b91c1c] hover:bg-[#dc2626] text-white disabled:opacity-50",
        )}
      >
        {loading && <Loader2 size={14} className="animate-spin" />}
        {!walletAddress ? "Connect wallet to bet" : `Bet ${amount} SOL on ${side.toUpperCase()}`}
      </button>
    </div>
  );
}
