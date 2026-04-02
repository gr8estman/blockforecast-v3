"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useWalletStore } from "@/store/walletStore";
import { Position } from "@/types";
import { getPaperPositions, getPaperBalance } from "@/lib/wallet/paper-trading";
import { formatPrice, formatUsd, formatPct, formatAmount, shortAddress } from "@/lib/utils";
import { cn, rugScoreColor } from "@/lib/utils";
import { Card, Badge, Spinner, SectionHeader } from "@/components/ui";
import {
  Briefcase, TrendingUp, TrendingDown, FlaskConical,
  ExternalLink, BarChart2, RefreshCw
} from "lucide-react";

function PositionRow({ pos }: { pos: Position }) {
  const isProfit = pos.pnl >= 0;
  return (
    <div className="grid grid-cols-7 items-center gap-2 px-4 py-3 text-sm border-b border-[#161b22] hover:bg-[#161b22] transition-colors">
      {/* Token */}
      <div className="col-span-2 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#1e2530] border border-[#30363d] flex items-center justify-center text-[10px] font-bold text-[#58a6ff] shrink-0">
          {pos.tokenSymbol.slice(0, 2)}
        </div>
        <div>
          <p className="text-xs font-bold text-[#e6edf3]">{pos.tokenSymbol}</p>
          <p className="text-[10px] text-[#484f58] font-mono">{shortAddress(pos.tokenAddress, 4)}</p>
        </div>
        {pos.isPaper && (
          <Badge variant="yellow" className="text-[9px] px-1">Paper</Badge>
        )}
      </div>

      {/* Amount */}
      <div>
        <p className="text-xs text-[#e6edf3] font-mono">{formatAmount(pos.amount)}</p>
        <p className="text-[10px] text-[#484f58]">tokens</p>
      </div>

      {/* Entry */}
      <div>
        <p className="text-xs text-[#8b949e] font-mono">{formatPrice(pos.entryPrice)}</p>
        <p className="text-[10px] text-[#484f58]">entry</p>
      </div>

      {/* Current */}
      <div>
        <p className="text-xs text-[#e6edf3] font-mono">{formatPrice(pos.currentPrice)}</p>
        <p className="text-[10px] text-[#484f58]">current</p>
      </div>

      {/* P&L */}
      <div>
        <p className={cn("text-xs font-mono font-bold", isProfit ? "text-[#3fb950]" : "text-[#f85149]")}>
          {isProfit ? "+" : ""}{formatUsd(pos.pnl)}
        </p>
        <p className={cn("text-[10px] font-mono", isProfit ? "text-[#3fb950]" : "text-[#f85149]")}>
          {formatPct(pos.pnlPct)}
        </p>
      </div>

      {/* Value + Action */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[#e6edf3] font-mono">{formatUsd(pos.valueUsd)}</p>
          <p className="text-[10px] text-[#484f58]">value</p>
        </div>
        <Link
          href={`/terminal/${pos.tokenAddress}`}
          className="p-1.5 rounded bg-[#1e2530] border border-[#30363d] hover:border-[#58a6ff] text-[#8b949e] hover:text-[#58a6ff] transition-all"
        >
          <BarChart2 size={12} />
        </Link>
      </div>
    </div>
  );
}

export function PortfolioView() {
  const { isPaperTrading, getActiveAddress } = useWalletStore();
  const [positions, setPositions] = useState<Position[]>([]);
  const [paperBalance, setPaperBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [walletPositions, setWalletPositions] = useState<Position[]>([]);

  const address = getActiveAddress();

  const loadPaperPositions = () => {
    const pos = getPaperPositions();
    setPositions(pos);
    setPaperBalance(getPaperBalance());
  };

  const loadWalletPositions = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio?address=${address}`);
      if (res.ok) {
        const data = await res.json();
        setWalletPositions(data.positions ?? []);
      }
    } catch (err) {
      console.error("Portfolio fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPaperPositions();
    if (address) loadWalletPositions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  const allPositions = isPaperTrading ? positions : walletPositions;
  const totalValue = allPositions.reduce((s, p) => s + p.valueUsd, 0);
  const totalPnl = allPositions.reduce((s, p) => s + p.pnl, 0);
  const totalPnlPct = totalValue > 0 ? (totalPnl / (totalValue - totalPnl)) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-xs text-[#8b949e] mb-1">Portfolio Value</p>
          <p className="text-xl font-bold font-mono text-[#e6edf3]">{formatUsd(totalValue)}</p>
          {isPaperTrading && (
            <p className="text-xs text-[#8b949e] mt-1">
              Cash: <span className="text-[#d29922]">${paperBalance.toFixed(2)}</span>
            </p>
          )}
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#8b949e] mb-1">Total P&L</p>
          <p className={cn("text-xl font-bold font-mono", totalPnl >= 0 ? "text-[#3fb950]" : "text-[#f85149]")}>
            {totalPnl >= 0 ? "+" : ""}{formatUsd(totalPnl)}
          </p>
          <p className={cn("text-xs font-mono mt-1", totalPnl >= 0 ? "text-[#3fb950]" : "text-[#f85149]")}>
            {formatPct(totalPnlPct)}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#8b949e] mb-1">Open Positions</p>
          <p className="text-xl font-bold font-mono text-[#e6edf3]">{allPositions.length}</p>
          <p className="text-xs text-[#484f58] mt-1">
            {allPositions.filter(p => p.pnl >= 0).length} profitable
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-[#8b949e] mb-1">Mode</p>
          <div className="flex items-center gap-2 mt-1">
            {isPaperTrading ? (
              <>
                <FlaskConical size={16} className="text-[#d29922]" />
                <span className="text-sm font-bold text-[#d29922]">Paper Trading</span>
              </>
            ) : (
              <>
                <Briefcase size={16} className="text-[#58a6ff]" />
                <span className="text-sm font-bold text-[#58a6ff]">Real Wallet</span>
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Positions Table */}
      <Card>
        <SectionHeader
          title={
            <span className="flex items-center gap-2">
              Positions
              {isPaperTrading && <Badge variant="yellow"><FlaskConical size={9} className="mr-0.5" />Paper</Badge>}
            </span>
          }
          action={
            <button
              onClick={() => { loadPaperPositions(); loadWalletPositions(); }}
              className="p-1 rounded hover:bg-[#1e2530] text-[#8b949e] hover:text-[#e6edf3] transition-all"
            >
              <RefreshCw size={12} />
            </button>
          }
        />

        {/* Table header */}
        <div className="grid grid-cols-7 gap-2 px-4 py-2 text-[10px] text-[#484f58] uppercase tracking-wide bg-[#080b12] border-b border-[#21262d]">
          <span className="col-span-2">Token</span>
          <span>Amount</span>
          <span>Entry</span>
          <span>Current</span>
          <span>P&L</span>
          <span>Value</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-sm text-[#8b949e]">
            <Spinner /> Loading positions…
          </div>
        ) : allPositions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase size={32} className="text-[#21262d] mb-3" />
            <p className="text-[#8b949e] text-sm">No open positions</p>
            <p className="text-[#484f58] text-xs mt-1">
              {isPaperTrading ? "Place paper trades to see them here" : "Connect wallet to view holdings"}
            </p>
            <Link href="/" className="mt-4 text-xs text-[#58a6ff] hover:underline">
              Browse new tokens →
            </Link>
          </div>
        ) : (
          allPositions.map((pos) => <PositionRow key={pos.tokenAddress} pos={pos} />)
        )}
      </Card>
    </div>
  );
}
