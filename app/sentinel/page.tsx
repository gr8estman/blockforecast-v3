"use client";

import React, { useState } from "react";
import { RugCheckResult } from "@/types";
import { RugAnalysisPanel } from "@/components/rug/RugAnalysisPanel";
import { Button, Card, Spinner, Badge } from "@/components/ui";
import { rugScoreColor, rugScoreLabel } from "@/lib/utils";
import { Shield, Search, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface WatchlistEntry {
  address: string;
  label?: string;
  addedAt: string;
  lastCheck?: RugCheckResult;
}

export default function SentinelPage() {
  const [inputAddress, setInputAddress] = useState("");
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [checking, setChecking] = useState<string | null>(null);
  const [singleResult, setSingleResult] = useState<RugCheckResult | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  const handleQuickCheck = async () => {
    const addr = inputAddress.trim();
    if (!addr || addr.length < 10) return;
    setSingleLoading(true);
    setSingleResult(null);
    try {
      const res = await fetch(`/api/rug-check/${addr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSingleResult(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setSingleLoading(false);
    }
  };

  const handleAddToWatchlist = () => {
    const addr = inputAddress.trim();
    if (!addr || watchlist.find((w) => w.address === addr)) return;
    setWatchlist((prev) => [
      ...prev,
      { address: addr, addedAt: new Date().toISOString() },
    ]);
    setInputAddress("");
  };

  const handleCheckWatchlistItem = async (entry: WatchlistEntry) => {
    setChecking(entry.address);
    try {
      const res = await fetch(`/api/rug-check/${entry.address}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: RugCheckResult = await res.json();
      setWatchlist((prev) =>
        prev.map((w) =>
          w.address === entry.address ? { ...w, lastCheck: result } : w
        )
      );
    } catch (err) {
      console.error(err);
    } finally {
      setChecking(null);
    }
  };

  const handleRemove = (address: string) => {
    setWatchlist((prev) => prev.filter((w) => w.address !== address));
  };

  return (
    <div className="h-full overflow-y-auto max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield size={22} className="text-[#58a6ff]" />
        <div>
          <h1 className="text-lg font-bold text-[#e6edf3]">Sentinel</h1>
          <p className="text-xs text-[#8b949e]">
            Instant rug analysis & token watchlist monitoring
          </p>
        </div>
      </div>

      {/* Quick Check */}
      <Card className="p-4 space-y-4">
        <h2 className="text-sm font-semibold text-[#e6edf3] flex items-center gap-2">
          <Search size={14} className="text-[#58a6ff]" />
          Instant Rug Check
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={inputAddress}
            onChange={(e) => setInputAddress(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickCheck()}
            placeholder="Paste Solana token mint address…"
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
          />
          <Button variant="primary" onClick={handleQuickCheck} loading={singleLoading}>
            Analyze
          </Button>
          <Button variant="outline" onClick={handleAddToWatchlist}>
            + Watchlist
          </Button>
        </div>

        {singleLoading && (
          <div className="flex items-center gap-2 text-sm text-[#8b949e]">
            <Spinner size={16} />
            Running rug analysis…
          </div>
        )}

        {singleResult && !singleLoading && (
          <div className="mt-2">
            <RugAnalysisPanel result={singleResult} />
          </div>
        )}
      </Card>

      {/* Watchlist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#e6edf3] flex items-center gap-2">
            <Clock size={14} className="text-[#8b949e]" />
            Watchlist
            {watchlist.length > 0 && (
              <Badge variant="blue">{watchlist.length}</Badge>
            )}
          </h2>
        </div>

        {watchlist.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12 text-center">
            <Shield size={32} className="text-[#21262d] mb-3" />
            <p className="text-[#8b949e] text-sm">No tokens in watchlist</p>
            <p className="text-xs text-[#484f58] mt-1">
              Paste an address above and click "+ Watchlist"
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {watchlist.map((entry) => {
              const score = entry.lastCheck?.overallScore;
              const isChecking = checking === entry.address;
              return (
                <Card key={entry.address} className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Score ring or shield */}
                    <div className="w-10 h-10 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center shrink-0">
                      {score !== undefined ? (
                        <span className={`text-sm font-bold font-mono ${rugScoreColor(score)}`}>
                          {score}
                        </span>
                      ) : (
                        <Shield size={16} className="text-[#484f58]" />
                      )}
                    </div>

                    {/* Address + label */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-mono text-[#e6edf3] truncate">
                          {entry.lastCheck?.tokenSymbol
                            ? `${entry.lastCheck.tokenSymbol} — `
                            : ""}
                          {entry.address}
                        </p>
                        {score !== undefined && (
                          <Badge
                            variant={score >= 70 ? "green" : score >= 40 ? "yellow" : "red"}
                            className="shrink-0"
                          >
                            {rugScoreLabel(score)}
                          </Badge>
                        )}
                      </div>
                      {entry.lastCheck && (
                        <p className="text-[10px] text-[#484f58] mt-0.5">
                          {entry.lastCheck.flags.length > 0
                            ? entry.lastCheck.flags[0]
                            : "No major flags detected"}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCheckWatchlistItem(entry)}
                        loading={isChecking}
                      >
                        Check
                      </Button>
                      <a
                        href={`/terminal/${entry.address}`}
                        className="px-2.5 py-1.5 rounded text-xs border border-[#30363d] hover:border-[#58a6ff] text-[#8b949e] hover:text-[#58a6ff] transition-all"
                      >
                        Trade
                      </a>
                      <button
                        onClick={() => handleRemove(entry.address)}
                        className="p-1.5 rounded text-[#484f58] hover:text-[#f85149] hover:bg-[#3d1a1a] transition-all"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
