"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, User } from "lucide-react";
import { shortAddress } from "@/lib/utils";

interface DevStats {
  devAddress: string;
  score: number;
  tokensCreated: number;
  rugRatio: number;
  walletAge: string;
  flags: string[];
}

interface Props {
  tokenAddress: string;
}

export function DevWalletScore({ tokenAddress }: Props) {
  const [stats, setStats]   = useState<DevStats | null>(null);
  const [loading, setLoad]  = useState(true);

  useEffect(() => {
    if (!tokenAddress) return;
    fetch(`/api/dev-score/${tokenAddress}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setStats(d); })
      .catch(() => {})
      .finally(() => setLoad(false));
  }, [tokenAddress]);

  if (loading || !stats) return null;

  const scoreColor =
    stats.score >= 70 ? "text-[#3fb950]" :
    stats.score >= 40 ? "text-[#d29922]" :
                        "text-[#f85149]";
  const scoreLabel =
    stats.score >= 70 ? "Safe" :
    stats.score >= 40 ? "Caution" :
                        "Risky";

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#080b12] border-b border-[#21262d]">
        <User size={12} className="text-[#8b949e]" />
        <span className="text-[11px] font-semibold text-[#e6edf3]">Dev Wallet</span>
        <span className={`ml-auto text-[10px] font-bold font-mono ${scoreColor}`}>
          {scoreLabel} {stats.score}/100
        </span>
      </div>
      <div className="p-2.5 space-y-1.5 text-[10px]">
        <div className="flex justify-between text-[#8b949e]">
          <span>Address</span>
          <a
            href={`https://solscan.io/account/${stats.devAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[#58a6ff] hover:underline"
          >
            {shortAddress(stats.devAddress, 5)}
          </a>
        </div>
        <div className="flex justify-between text-[#8b949e]">
          <span>Tokens created</span>
          <span className="font-mono text-[#e6edf3]">{stats.tokensCreated}</span>
        </div>
        <div className="flex justify-between text-[#8b949e]">
          <span>Rug ratio</span>
          <span className={`font-mono ${stats.rugRatio > 0.4 ? "text-[#f85149]" : "text-[#3fb950]"}`}>
            {(stats.rugRatio * 100).toFixed(0)}%
          </span>
        </div>
        <div className="flex justify-between text-[#8b949e]">
          <span>Wallet age</span>
          <span className="font-mono text-[#e6edf3]">{stats.walletAge}</span>
        </div>
        {stats.flags.length > 0 && (
          <div className="space-y-0.5 pt-1 border-t border-[#161b22]">
            {stats.flags.map((f, i) => (
              <div key={i} className="flex items-start gap-1 text-[#d29922]">
                <AlertTriangle size={9} className="mt-0.5 shrink-0" />
                {f}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
