"use client";

import { useEffect, useState } from "react";
import { useParams }           from "next/navigation";
import { useTradingStore }     from "@/store/tradingStore";
import { useWalletStore }      from "@/store/walletStore";
import { TradingChart }        from "@/components/terminal/TradingChart";
import { TradeHistory }        from "@/components/terminal/TradeHistory";
import { OrderForm }           from "@/components/terminal/OrderForm";
import { TopTraders }          from "@/components/terminal/TopTraders";
import { TokenInfo }           from "@/components/terminal/TokenInfo";
import AISignalWidget          from "@/components/terminal/AISignalWidget";
import { LPDrainAlert }        from "@/components/terminal/LPDrainAlert";
import { DevWalletScore }      from "@/components/terminal/DevWalletScore";
import { SmartMoneyAlert }     from "@/components/terminal/SmartMoneyAlert";
import { getPaperPositions, updatePositionPrices } from "@/lib/wallet/paper-trading";
import { formatPrice, formatUsd, formatPct }       from "@/lib/utils";
import { cn }                  from "@/lib/utils";
import { NewToken, Position }  from "@/types";

type BottomTab = "transactions" | "positions" | "toptraders";


export default function TerminalPage() {
  const { token } = useParams<{ token: string }>();
  const { activeTokenMeta, setActiveToken, setLivePrice, clearTrades, livePrice } = useTradingStore();
  const { isPaperTrading } = useWalletStore();
  const [bottomTab, setBottomTab]     = useState<BottomTab>("transactions");
  const [paperPositions, setPaperPositions] = useState<Position[]>([]);

  useEffect(() => {
    setPaperPositions(getPaperPositions());
  }, [bottomTab]);

  useEffect(() => {
    if (!token || livePrice <= 0) return;
    updatePositionPrices({ [token]: livePrice });
    setPaperPositions(getPaperPositions());
  }, [livePrice, token]);

  useEffect(() => {
    if (!token) return;
    clearTrades();

    let cached: NewToken | null = null;
    try { cached = JSON.parse(sessionStorage.getItem(`token_meta_${token}`) ?? ""); } catch { /* ignore */ }
    const placeholder: NewToken = cached ?? {
      address: token, name: "Loading…",
      symbol: token.slice(0, 6).toUpperCase(),
      createdAt: new Date().toISOString(), creatorAddress: "",
      initialLiquidity: 0, currentPrice: 0, priceChange5m: 0, priceChange1h: 0,
      volume24h: 0, marketCap: 0, holders: 0, trades: 0,
      rugScore: 50, graduated: false, dex: "pump.fun",
    };
    setActiveToken(token, placeholder);

    fetch(`/api/token-stats/${token}`)
      .then((r) => r.json())
      .then((s) => {
        if (s.latestPriceUsd > 0) setLivePrice(s.latestPriceUsd);
        setActiveToken(token, {
          ...placeholder,
          currentPrice:  s.latestPriceUsd  || placeholder.currentPrice,
          priceChange5m: s.priceChange5m   ?? placeholder.priceChange5m,
          priceChange1h: s.priceChange1h   ?? placeholder.priceChange1h,
          volume24h:     s.volume24h        || placeholder.volume24h,
          marketCap:     s.marketCap        || placeholder.marketCap,
          holders:       s.holderCount      || placeholder.holders,
          trades:        s.tradeCount24h    || placeholder.trades,
        });
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-[#050505]">
      {/* Token header — single thin bar */}
      <TokenInfo />

      {/* Main layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left: chart + bottom panel ────────────────────────────────────── */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex-1 min-h-0">
            <TradingChart />
          </div>

          {/* Bottom tabs panel */}
          <div className="h-56 shrink-0 flex flex-col border-t border-[#111] bg-[#050505]">
              <div className="flex flex-col h-full bg-[#050505]">
                {/* Tab bar */}
                <div className="flex items-center h-7 border-b border-[#111] shrink-0">
                  {([
                    { id: "transactions" as BottomTab, label: "Trades"      },
                    { id: "positions"    as BottomTab, label: "Positions"   },
                    { id: "toptraders"   as BottomTab, label: "Top Traders" },
                  ]).map(({ id, label }) => (
                    <button
                      key={id}
                      onClick={() => setBottomTab(id)}
                      className={cn(
                        "px-4 h-full text-[10px] font-medium border-b-2 -mb-px transition-colors uppercase tracking-wider",
                        bottomTab === id
                          ? "border-[#2dd4bf] text-[#2dd4bf]"
                          : "border-transparent text-[#333] hover:text-[#555]",
                      )}
                    >
                      {label}
                      {id === "positions" && isPaperTrading && paperPositions.length > 0 && (
                        <span className="ml-1 text-[9px] bg-[#111] text-[#555] rounded px-1">{paperPositions.length}</span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  {bottomTab === "transactions" && <TradeHistory hideHeader />}
                  {bottomTab === "toptraders"   && <TopTraders />}
                  {bottomTab === "positions" && (
                    <div className="h-full overflow-y-auto" style={{ scrollbarWidth: "none" }}>
                      {paperPositions.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-[#333] text-xs">
                          {isPaperTrading ? "No open paper positions" : "Enable paper trading"}
                        </div>
                      ) : (
                        <table className="w-full text-[11px] font-mono">
                          <thead className="sticky top-0 bg-[#050505]">
                            <tr className="text-[#333] text-[9px] uppercase">
                              <th className="px-3 py-1 text-left">Token</th>
                              <th className="px-3 py-1 text-right">Entry</th>
                              <th className="px-3 py-1 text-right">Current</th>
                              <th className="px-3 py-1 text-right">Value</th>
                              <th className="px-3 py-1 text-right">P&amp;L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paperPositions.map((pos) => (
                              <tr key={pos.tokenAddress} className="border-t border-[#0d0d0d] hover:bg-[#0a0a0a]">
                                <td className="px-3 py-1 text-[#c9d1d9] font-bold">{pos.tokenSymbol}</td>
                                <td className="px-3 py-1 text-right text-[#555]">{formatPrice(pos.entryPrice)}</td>
                                <td className="px-3 py-1 text-right text-[#c9d1d9]">{formatPrice(pos.currentPrice)}</td>
                                <td className="px-3 py-1 text-right text-[#555]">{formatUsd(pos.valueUsd)}</td>
                                <td className={cn("px-3 py-1 text-right font-bold",
                                  pos.pnl >= 0 ? "text-[#2dd4bf]" : "text-[#fb7185]")}>
                                  {pos.pnl >= 0 ? "+" : ""}{formatUsd(pos.pnl)}
                                  <span className="ml-1 text-[9px] opacity-60">({formatPct(pos.pnlPct)})</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </div>
          </div>
        </div>

        {/* ── Right: signals + order form ───────────────────────────────────── */}
        <div className="w-64 shrink-0 border-l border-[#111] flex flex-col overflow-y-auto bg-[#050505]" style={{ scrollbarWidth: "none" }}>
            <div className="shrink-0"><AISignalWidget
              tokenAddress={token}
              symbol={activeTokenMeta?.symbol ?? token.slice(0, 6).toUpperCase()}
              rugScore={activeTokenMeta?.rugScore ?? 50}
              holders={activeTokenMeta?.holders ?? 0}
            /></div>
            <div className="border-t border-[#111] shrink-0" />
            <div className="shrink-0"><SmartMoneyAlert tokenAddress={token} /></div>
            <div className="border-t border-[#111] shrink-0" />
            <div className="shrink-0"><LPDrainAlert tokenAddress={token} /></div>
            <div className="border-t border-[#111] shrink-0" />
            <div className="shrink-0"><DevWalletScore tokenAddress={token} /></div>
            <div className="border-t border-[#111] shrink-0" />
            <div className="shrink-0"><OrderForm /></div>
        </div>
      </div>
    </div>
  );
}
