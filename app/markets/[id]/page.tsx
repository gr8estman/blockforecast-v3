"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams }        from "next/navigation";
import Link                 from "next/link";
import {
  ArrowLeft, Clock, Users, TrendingUp, ExternalLink,
  Shield, Zap, HelpCircle, RefreshCw,
} from "lucide-react";
import { BetPanel }         from "@/components/markets/BetPanel";
import { OddsBar }          from "@/components/markets/OddsBar";
import { Market, Bet }      from "@/lib/prediction/types";
import { useWalletStore }   from "@/store/walletStore";
import { shortAddress, timeAgo, cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  price:      TrendingUp,
  rug:        Shield,
  graduation: Zap,
  custom:     HelpCircle,
};

export default function MarketDetailPage() {
  const { id }             = useParams<{ id: string }>();
  const { phantomAddress, generated } = useWalletStore();
  const walletAddress      = phantomAddress ?? generated?.publicKey ?? null;

  const [market,   setMarket]   = useState<Market | null>(null);
  const [bets,     setBets]     = useState<Bet[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchMarket = useCallback(async () => {
    try {
      const res  = await fetch(`/api/markets/${id}`);
      if (res.status === 404) { setNotFound(true); return; }
      const data = await res.json();
      setMarket(data.market);
      setBets(data.bets ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMarket(); }, [fetchMarket]);

  if (loading) return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 py-10 text-center text-[#8b949e] text-sm">Loading market…</div>
  );

  if (notFound || !market) return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 py-10 text-center">
      <p className="text-[#8b949e] text-sm mb-4">Market not found.</p>
      <Link href="/markets" className="text-[#58a6ff] text-sm hover:underline">← Back to markets</Link>
    </div>
  );

  const CategoryIcon = CATEGORY_ICONS[market.category] ?? HelpCircle;
  const totalPool    = market.yesPool + market.noPool;
  const yesOdds      = totalPool > 0 ? (market.yesPool / totalPool) * 100 : 50;
  const noOdds       = 100 - yesOdds;
  const expired      = new Date() > new Date(market.endTime);

  // Group bets by outcome for the leaderboard
  const yesBets = bets.filter((b) => b.outcome === "yes").sort((a, b) => b.amount - a.amount);
  const noBets  = bets.filter((b) => b.outcome === "no").sort((a, b) => b.amount - a.amount);

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 py-6">
      <Link href="/markets" className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#e6edf3] text-sm mb-6 transition-colors w-fit">
        <ArrowLeft size={14} /> All Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — market info */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header card */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <CategoryIcon size={14} className="text-[#58a6ff]" />
              <span className="text-[11px] text-[#8b949e] capitalize">{market.category}</span>
              {market.tokenSymbol && (
                <span className="text-[11px] bg-[#1e2530] text-[#58a6ff] px-2 py-0.5 rounded font-mono ml-1">
                  ${market.tokenSymbol}
                </span>
              )}
              {market.token && (
                <Link
                  href={`/terminal/${market.token}`}
                  className="flex items-center gap-1 text-[10px] text-[#8b949e] hover:text-[#58a6ff] transition-colors ml-auto"
                >
                  Open terminal <ExternalLink size={10} />
                </Link>
              )}
            </div>

            <h1 className="text-lg font-bold text-[#e6edf3] mb-3 leading-snug">{market.question}</h1>

            {market.description && (
              <p className="text-[13px] text-[#8b949e] mb-4 leading-relaxed">{market.description}</p>
            )}

            {/* Status / timing */}
            <div className="flex items-center gap-3 text-[11px] text-[#8b949e] mb-4">
              <div className="flex items-center gap-1">
                <Clock size={11} />
                {market.status === "open"
                  ? expired ? "Betting ended" : `Closes ${timeAgo(market.endTime)} ago`
                  : `Resolved ${market.resolveTime ? timeAgo(market.resolveTime) + " ago" : ""}`}
              </div>
              <div className="flex items-center gap-1">
                <Users size={11} />
                {market.totalBets} bets
              </div>
              <button onClick={fetchMarket} className="ml-auto text-[#484f58] hover:text-[#8b949e] transition-colors">
                <RefreshCw size={11} />
              </button>
            </div>

            {/* Odds bar */}
            <OddsBar yesPool={market.yesPool} noPool={market.noPool} />

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { label: "YES pool", value: `${market.yesPool.toFixed(3)} SOL`, color: "text-[#3fb950]" },
                { label: "NO pool",  value: `${market.noPool.toFixed(3)} SOL`,  color: "text-[#f85149]" },
                { label: "Total",    value: `${totalPool.toFixed(3)} SOL`,       color: "text-[#e6edf3]" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-[#161b22] rounded p-2 text-center">
                  <p className="text-[10px] text-[#8b949e] mb-0.5">{label}</p>
                  <p className={cn("text-[13px] font-mono font-semibold", color)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Resolved outcome */}
            {market.status === "resolved" && market.outcome && (
              <div className={cn(
                "mt-4 text-center py-3 rounded-lg text-sm font-bold",
                market.outcome === "yes" ? "bg-[#1a2d1a] text-[#3fb950]" : "bg-[#2d1a1a] text-[#f85149]",
              )}>
                RESOLVED: {market.outcome.toUpperCase()}
                {market.outcome === "yes"
                  ? ` — YES winners share ${(totalPool * (1 - market.feePct)).toFixed(3)} SOL`
                  : ` — NO winners share ${(totalPool * (1 - market.feePct)).toFixed(3)} SOL`}
              </div>
            )}
          </div>

          {/* Bet breakdown */}
          {bets.length > 0 && (
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-[#e6edf3] mb-3">Bet Breakdown</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* YES side */}
                <div>
                  <p className="text-[11px] text-[#3fb950] font-semibold mb-2">
                    YES · {yesOdds.toFixed(1)}% · {yesBets.length} bets
                  </p>
                  <div className="space-y-1">
                    {yesBets.slice(0, 8).map((bet) => (
                      <div key={bet.id} className="flex justify-between text-[11px]">
                        <span className="text-[#8b949e] font-mono">{shortAddress(bet.bettor)}</span>
                        <span className="text-[#3fb950] font-mono">{bet.amount.toFixed(3)} SOL</span>
                      </div>
                    ))}
                    {yesBets.length > 8 && (
                      <p className="text-[10px] text-[#484f58]">+{yesBets.length - 8} more</p>
                    )}
                  </div>
                </div>
                {/* NO side */}
                <div>
                  <p className="text-[11px] text-[#f85149] font-semibold mb-2">
                    NO · {noOdds.toFixed(1)}% · {noBets.length} bets
                  </p>
                  <div className="space-y-1">
                    {noBets.slice(0, 8).map((bet) => (
                      <div key={bet.id} className="flex justify-between text-[11px]">
                        <span className="text-[#8b949e] font-mono">{shortAddress(bet.bettor)}</span>
                        <span className="text-[#f85149] font-mono">{bet.amount.toFixed(3)} SOL</span>
                      </div>
                    ))}
                    {noBets.length > 8 && (
                      <p className="text-[10px] text-[#484f58]">+{noBets.length - 8} more</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — bet panel */}
        <div className="space-y-4">
          <BetPanel
            market={market}
            walletAddress={walletAddress}
            onBetPlaced={fetchMarket}
          />

          {/* My bets */}
          {walletAddress && bets.filter((b) => b.bettor.toLowerCase() === walletAddress.toLowerCase()).length > 0 && (
            <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4">
              <h3 className="text-[12px] font-semibold text-[#e6edf3] mb-3">My Bets</h3>
              <div className="space-y-2">
                {bets
                  .filter((b) => b.bettor.toLowerCase() === walletAddress.toLowerCase())
                  .map((bet) => (
                    <div key={bet.id} className="flex justify-between text-[11px]">
                      <span className={cn(
                        "font-semibold",
                        bet.outcome === "yes" ? "text-[#3fb950]" : "text-[#f85149]",
                      )}>
                        {bet.outcome.toUpperCase()}
                      </span>
                      <span className="text-[#e6edf3] font-mono">{bet.amount.toFixed(3)} SOL</span>
                      {bet.payout !== undefined && (
                        <span className={cn("font-mono", bet.payout > 0 ? "text-[#3fb950]" : "text-[#f85149]")}>
                          {bet.payout > 0 ? `→ ${bet.payout.toFixed(3)}` : "✗ lost"}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Creator tools */}
          {walletAddress && walletAddress === market.creator && market.status === "open" && expired && (
            <div className="bg-[#0d1117] border border-[#d29922]/40 rounded-lg p-4">
              <p className="text-[12px] text-[#d29922] font-semibold mb-3">Resolve Market (Creator)</p>
              <p className="text-[11px] text-[#8b949e] mb-3">Betting closed. Set the outcome:</p>
              <div className="flex gap-2">
                {(["yes", "no"] as const).map((outcome) => (
                  <button
                    key={outcome}
                    onClick={async () => {
                      const adminKey = prompt("Admin key:");
                      if (!adminKey) return;
                      await fetch(`/api/markets/${id}/resolve`, {
                        method:  "POST",
                        headers: { "Content-Type": "application/json" },
                        body:    JSON.stringify({ outcome, adminKey }),
                      });
                      fetchMarket();
                    }}
                    className={cn(
                      "flex-1 py-2 rounded text-xs font-bold transition-colors",
                      outcome === "yes"
                        ? "bg-[#238636] hover:bg-[#2ea043] text-white"
                        : "bg-[#b91c1c] hover:bg-[#dc2626] text-white",
                    )}
                  >
                    Resolve {outcome.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
