"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWalletStore } from "@/store/walletStore";
import { useTradingStore } from "@/store/tradingStore";
import { formatPrice, formatPct, shortAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Activity, Clock, Wifi, AlertTriangle } from "lucide-react";

export function StatusBar() {
  const { mode, isPaperTrading, solBalance, getActiveAddress } = useWalletStore();
  const { livePrice, priceChange, activeTokenMeta } = useTradingStore();
  const [time, setTime] = useState("");
  const connected = true;
  const address = getActiveAddress();

  useEffect(() => {
    const tick = () => {
      setTime(new Date().toUTCString().slice(17, 25) + " UTC");
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="h-6 bg-[#0d1117] border-t border-[#21262d] flex items-center px-4 gap-4 text-[10px] font-mono shrink-0">
      {/* Connection status */}
      <div className="flex items-center gap-1.5">
        <Wifi size={10} className={connected ? "text-[#3fb950]" : "text-[#f85149]"} />
        <span className={connected ? "text-[#3fb950]" : "text-[#f85149]"}>
          {connected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>

      <div className="w-px h-3 bg-[#21262d]" />

      {/* Mode */}
      <span className={cn(
        "px-1.5 py-0.5 rounded",
        isPaperTrading ? "text-[#d29922] bg-[#3d2f0a]" : "text-[#8b949e]"
      )}>
        {isPaperTrading ? "PAPER TRADING" : mode === "generated" ? "BOT WALLET" : "PHANTOM"}
      </span>

      {/* Address */}
      {address && (
        <>
          <div className="w-px h-3 bg-[#21262d]" />
          <span className="text-[#484f58]">{shortAddress(address, 6)}</span>
        </>
      )}

      {/* SOL Balance */}
      {solBalance > 0 && (
        <>
          <div className="w-px h-3 bg-[#21262d]" />
          <span className="text-[#8b949e]">{solBalance.toFixed(4)} SOL</span>
        </>
      )}

      {/* Active token price */}
      {activeTokenMeta && livePrice > 0 && (
        <>
          <div className="w-px h-3 bg-[#21262d]" />
          <div className="flex items-center gap-2">
            <Activity size={9} className="text-[#58a6ff]" />
            <span className="text-[#e6edf3]">{activeTokenMeta.symbol}</span>
            <span className="text-[#58a6ff]">{formatPrice(livePrice)}</span>
            <span className={priceChange >= 0 ? "text-[#3fb950]" : "text-[#f85149]"}>
              {formatPct(priceChange)}
            </span>
          </div>
        </>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Network */}
      <span className="text-[#484f58]">SOLANA MAINNET</span>

      <div className="w-px h-3 bg-[#21262d]" />

      {/* Risk disclaimer link */}
      <Link
        href="/settings#disclaimer"
        className="flex items-center gap-1 text-[#484f58] hover:text-[#d29922] transition-colors"
      >
        <AlertTriangle size={8} />
        <span>Risk Disclaimer</span>
      </Link>

      <div className="w-px h-3 bg-[#21262d]" />

      {/* Clock */}
      <div className="flex items-center gap-1">
        <Clock size={9} className="text-[#484f58]" />
        <span className="text-[#484f58]">{time}</span>
      </div>
    </div>
  );
}
