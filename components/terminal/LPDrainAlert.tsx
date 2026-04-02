"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeToLPDrain } from "@/lib/bitquery/websocket";
import { AlertTriangle, Droplets } from "lucide-react";

const DRAIN_ALERT_PCT = 15; // alert if LP drops ≥15% in one event

interface Props {
  tokenAddress: string;
}

export function LPDrainAlert({ tokenAddress }: Props) {
  const [alerts, setAlerts]     = useState<string[]>([]);
  const [currentLiq, setLiq]    = useState<number | null>(null);
  const [status, setStatus]     = useState<"watching" | "error">("watching");
  const prevQuote               = useRef<number | null>(null);

  useEffect(() => {
    if (!tokenAddress) return;

    const unsub = subscribeToLPDrain(
      tokenAddress,
      (event) => {
        // quoteAmount from Bitquery DEXPools is already in SOL (decimal)
        const solNow = event.quoteAmount;
        setLiq(solNow);

        if (prevQuote.current !== null && prevQuote.current > 0) {
          const pct = ((solNow - prevQuote.current) / prevQuote.current) * 100;
          if (pct <= -DRAIN_ALERT_PCT) {
            const msg = `LP -${Math.abs(pct).toFixed(1)}% (${prevQuote.current.toFixed(2)} → ${solNow.toFixed(2)} SOL)`;
            setAlerts((prev) => [msg, ...prev].slice(0, 5));
          }
        }
        prevQuote.current = solNow;
      },
      () => setStatus("error")
    );

    return () => unsub();
  }, [tokenAddress]);

  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#080b12] border-b border-[#21262d]">
        <Droplets size={12} className={alerts.length > 0 ? "text-[#f85149]" : "text-[#58a6ff]"} />
        <span className="text-[11px] font-semibold text-[#e6edf3]">LP Monitor</span>
        {currentLiq !== null && (
          <span className="ml-auto text-[10px] font-mono text-[#8b949e]">
            {currentLiq.toFixed(2)} SOL
          </span>
        )}
      </div>
      <div className="p-2.5 space-y-1">
        {status === "error" && (
          <p className="text-[10px] text-[#484f58]">Subscription unavailable</p>
        )}
        {status === "watching" && alerts.length === 0 && (
          <p className="text-[10px] text-[#484f58]">Watching for liquidity changes…</p>
        )}
        {alerts.map((alert, i) => (
          <div key={i} className="flex items-start gap-1.5 text-[10px] text-[#f85149] bg-[#3d1a1a] rounded px-2 py-1">
            <AlertTriangle size={10} className="mt-0.5 shrink-0" />
            {alert}
          </div>
        ))}
      </div>
    </div>
  );
}
