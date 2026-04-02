"use client";

import { useEffect, useState } from "react";
import { shortAddress, formatUsd } from "@/lib/utils";
import { Spinner } from "@/components/ui";

interface TopTrader {
  rank:         number;
  address:      string;
  totalVolume:  number;
  totalTrades:  number;
  buyTrades:    number;
  sellTrades:   number;
  uniqueTokens: number;
  buyPct:       number;
}

export function TopTraders() {
  const [traders, setTraders] = useState<TopTrader[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/top-traders")
      .then((r) => r.json())
      .then((d) => setTraders(d.traders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full gap-2 text-[#484f58] text-xs">
        <Spinner size={14} />
        Loading top traders…
      </div>
    );
  }

  if (traders.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-[#484f58] text-xs">
        No trader data available
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <table className="w-full text-[11px] font-mono">
        <thead className="sticky top-0 bg-[#080b12] z-10">
          <tr className="text-[#484f58] text-[10px]">
            <th className="px-3 py-1.5 text-left">#</th>
            <th className="px-3 py-1.5 text-left">Wallet</th>
            <th className="px-3 py-1.5 text-right">Vol 24h</th>
            <th className="px-3 py-1.5 text-right">Trades</th>
            <th className="px-3 py-1.5 text-right">Buy%</th>
            <th className="px-3 py-1.5 text-right">Tokens</th>
          </tr>
        </thead>
        <tbody>
          {traders.map((t, i) => (
            <tr key={`${t.address}-${i}`} className="border-t border-[#161b22] hover:bg-[#161b22] transition-colors">
              <td className="px-3 py-1 text-[#484f58]">{t.rank}</td>
              <td className="px-3 py-1">
                <a
                  href={`https://solscan.io/account/${t.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#58a6ff] hover:underline font-mono"
                >
                  {shortAddress(t.address, 4)}
                </a>
              </td>
              <td className="px-3 py-1 text-right text-[#e6edf3]">
                {formatUsd(t.totalVolume)}
              </td>
              <td className="px-3 py-1 text-right text-[#8b949e]">{t.totalTrades}</td>
              <td className={`px-3 py-1 text-right font-bold ${t.buyPct >= 60 ? "text-[#3fb950]" : t.buyPct >= 40 ? "text-[#8b949e]" : "text-[#f85149]"}`}>
                {t.buyPct}%
              </td>
              <td className="px-3 py-1 text-right text-[#8b949e]">{t.uniqueTokens}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
