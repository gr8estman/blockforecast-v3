"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NewToken } from "@/types";
import { formatPrice, formatUsd, formatAmount, shortAddress } from "@/lib/utils";
import { Spinner } from "@/components/ui";
import { Zap, ExternalLink } from "lucide-react";

export default function TonDiscoveryPage() {
  const [tokens, setTokens] = useState<NewToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]    = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ton-tokens")
      .then((r) => r.json())
      .then((d) => setTokens(d.tokens ?? []))
      .catch(() => setError("Failed to load TON tokens"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#0088cc]/20 border border-[#0088cc]/40 flex items-center justify-center text-lg">
          💎
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#e6edf3]">TON Discovery</h1>
          <p className="text-xs text-[#8b949e]">Top tokens on The Open Network — last 1 hour by volume</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-[#8b949e] bg-[#161b22] border border-[#30363d] rounded px-2 py-1">
          <Zap size={10} className="text-[#0088cc]" />
          <span>GeckoTerminal</span>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20 gap-2 text-[#8b949e]">
          <Spinner /> Loading TON tokens…
        </div>
      )}

      {error && (
        <div className="text-center py-20 text-[#f85149]">{error}</div>
      )}

      {!loading && !error && tokens.length === 0 && (
        <div className="text-center py-20 text-[#484f58]">
          No TON tokens found in the last hour. Try refreshing.
        </div>
      )}

      {!loading && tokens.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[#484f58] text-[10px] border-b border-[#21262d]">
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Token</th>
                <th className="px-3 py-2 text-left">Address</th>
                <th className="px-3 py-2 text-right">Price</th>
                <th className="px-3 py-2 text-right">Volume 1h</th>
                <th className="px-3 py-2 text-right">Trades</th>
                <th className="px-3 py-2 text-right">DEX</th>
                <th className="px-3 py-2 text-center">Links</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#161b22]">
              {tokens.map((token, i) => (
                <tr key={token.address} className="hover:bg-[#161b22] transition-colors">
                  <td className="px-3 py-2 text-[#484f58]">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#0088cc]/20 border border-[#0088cc]/30 flex items-center justify-center text-[9px] font-bold text-[#0088cc]">
                        {token.symbol.slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-bold text-[#e6edf3]">{token.symbol}</p>
                        <p className="text-[9px] text-[#484f58] truncate max-w-[120px]">{token.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-[#8b949e]">
                    {shortAddress(token.address, 6)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[#e6edf3]">
                    {token.currentPrice > 0 ? formatPrice(token.currentPrice) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[#8b949e]">
                    {token.volume24h > 0 ? formatUsd(token.volume24h) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-[#8b949e]">
                    {formatAmount(token.trades)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#161b22] border border-[#30363d] text-[#8b949e]">
                      {token.dex}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <a
                      href={`https://tonviewer.com/${token.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-0.5 text-[#0088cc] hover:text-[#29b6f6] text-[9px]"
                    >
                      View <ExternalLink size={8} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-center pt-4 border-t border-[#21262d]">
        <Link href="/" className="text-[11px] text-[#58a6ff] hover:underline">
          ← Back to Solana Discovery
        </Link>
      </div>
    </div>
  );
}
