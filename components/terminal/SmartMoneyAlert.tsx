"use client";

import { useEffect, useState } from "react";
import { Brain } from "lucide-react";
import { formatUsd, shortAddress } from "@/lib/utils";

interface SmartWallet {
  address: string;
  buyUsd: number;
  sellUsd: number;
  netUsd: number;
  tradeCount: number;
}

interface Props {
  tokenAddress: string;
}

export function SmartMoneyAlert({ tokenAddress }: Props) {
  const [wallets, setWallets] = useState<SmartWallet[]>([]);

  useEffect(() => {
    if (!tokenAddress) return;
    fetch(`/api/smart-money/${tokenAddress}`)
      .then((r) => r.json())
      .then((d) => setWallets(d.wallets ?? []))
      .catch(() => {});
  }, [tokenAddress]);

  if (wallets.length === 0) return null;

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#080b12] border-b border-[#21262d]">
        <Brain size={12} className="text-[#d29922]" />
        <span className="text-[11px] font-semibold text-[#e6edf3]">Smart Money</span>
        <span className="ml-auto text-[9px] text-[#484f58]">24h top traders</span>
      </div>
      <div className="divide-y divide-[#161b22]">
        {wallets.map((w) => (
          <div key={w.address} className="px-3 py-1.5 flex items-center gap-2 text-[10px]">
            <a
              href={`https://solscan.io/account/${w.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-[#58a6ff] hover:underline"
            >
              {shortAddress(w.address, 4)}
            </a>
            <div className="flex-1 flex items-center justify-end gap-1.5">
              <span className="text-[#484f58]">{w.tradeCount}tx</span>
              <span className="text-[#3fb950]">↑{formatUsd(w.buyUsd)}</span>
              {w.sellUsd > 0 && (
                <span className="text-[#f85149]">↓{formatUsd(w.sellUsd)}</span>
              )}
            </div>
            <span className={`font-mono font-bold ${w.netUsd >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}`}>
              {w.netUsd >= 0 ? "+" : ""}{formatUsd(w.netUsd)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
