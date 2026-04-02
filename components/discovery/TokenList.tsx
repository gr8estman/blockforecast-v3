"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { NewToken } from "@/types";
import { TokenCard } from "./TokenCard";
import { Spinner, LiveDot } from "@/components/ui";
import { RefreshCw, Search, Shield, Zap, TrendingUp, CheckCircle, Skull, AlertTriangle, BarChart2, Pin } from "lucide-react";
import { cn } from "@/lib/utils";

type SourceTab = "new" | "movers" | "safe" | "medium" | "rug";
type MoverSort = "volume" | "gainers";

const SCAN_BATCH = 8;
const MAX_SCANS  = 30;

const TABS: { id: SourceTab; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: "new",    label: "New",    icon: <Zap size={12} />,           desc: "Latest pump.fun launches (unscanned)" },
  { id: "movers", label: "Movers", icon: <TrendingUp size={12} />,    desc: "DexScreener gainers + Phantom trending (rug-scanned)" },
  { id: "safe",   label: "Safe",   icon: <CheckCircle size={12} />,   desc: "Movers with safe rug score (≥70)" },
  { id: "medium", label: "Medium", icon: <AlertTriangle size={12} />, desc: "Movers with moderate risk (40–70)" },
  { id: "rug",    label: "Rug",    icon: <Skull size={12} />,         desc: "New launches + high rug risk movers" },
];

const TAB_COLORS: Record<SourceTab, string> = {
  new:    "text-[#58a6ff]",
  movers: "text-[#d29922]",
  safe:   "text-[#3fb950]",
  medium: "text-[#d29922]",
  rug:    "text-[#f85149]",
};

export function TokenList() {
  const router = useRouter();
  const [tab, setTab] = useState<SourceTab>("new");

  const [newTokens,   setNewTokens]   = useState<NewToken[]>([]);
  const [moverTokens, setMoverTokens] = useState<NewToken[]>([]);
  const [moverSort,   setMoverSort]   = useState<MoverSort>("gainers");

  const [loadingNew,    setLoadingNew]    = useState(true);
  const [loadingMovers, setLoadingMovers] = useState(true);

  const [search, setSearch]             = useState("");
  const [scanProgress, setScanProgress] = useState<{ done: number; total: number } | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [refreshing, setRefreshing]     = useState(false);

  const scannedRef = useRef<Set<string>>(new Set());

  // ─── Pinned tokens (persisted to localStorage) ────────────────────────────────
  const [pinnedAddresses, setPinnedAddresses] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("bf_pinned_tokens");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch { return new Set(); }
  });

  const togglePin = useCallback((address: string) => {
    setPinnedAddresses((prev) => {
      const next = new Set(prev);
      if (next.has(address)) next.delete(address);
      else next.add(address);
      try { localStorage.setItem("bf_pinned_tokens", JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // ─── Rug-scan movers batch ───────────────────────────────────────────────────
  const runRugScans = useCallback(async (candidates: NewToken[]) => {
    const toScan = [...candidates]
      // Top gainers first — biggest price moves are the highest-priority scan targets.
      // Volume breaks ties so liquid tokens aren't buried behind low-vol pumps.
      .sort((a, b) =>
        b.priceChange5m !== a.priceChange5m
          ? b.priceChange5m - a.priceChange5m
          : b.volume24h    - a.volume24h
      )
      .filter((t) => !scannedRef.current.has(t.address))
      .slice(0, MAX_SCANS);
    if (toScan.length === 0) return;

    setScanProgress({ done: 0, total: toScan.length });
    let done = 0;

    for (let i = 0; i < toScan.length; i += SCAN_BATCH) {
      const batch = toScan.slice(i, i + SCAN_BATCH);
      await Promise.allSettled(
        batch.map(async (tok) => {
          scannedRef.current.add(tok.address);
          try {
            const res = await fetch(`/api/rug-check/${tok.address}`);
            if (!res.ok) return;
            const data = await res.json();
            const score: number = data.overallScore ?? 50;
            setMoverTokens((prev) =>
              prev.map((t) => (t.address === tok.address ? { ...t, rugScore: score } : t))
            );
          } catch {
            // silent — token keeps its baseline score
          } finally {
            done++;
            setScanProgress((p) => (p ? { ...p, done } : null));
          }
        })
      );
    }
    setScanProgress(null);
  }, []);

  // ─── Enrich tokens with batch-stats (price, volume, buy pressure, wash, BC progress) ──
  const enrichWithBatchStats = useCallback(async (tokens: NewToken[], setter: React.Dispatch<React.SetStateAction<NewToken[]>>) => {
    const addresses = tokens.map((t) => t.address);
    if (addresses.length === 0) return;
    try {
      const res = await fetch("/api/batch-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      if (!res.ok) return;
      const stats = await res.json() as Record<string, {
        price: number; volume: number; trades: number; holders: number; marketCap: number;
        priceChange5m: number; priceChange1h: number;
        buyPressurePct: number; washScore: number; bondingCurveProgress: number;
      }>;
      setter((prev) => prev.map((t) => {
        const s = stats[t.address];
        if (!s) return t;
        return {
          ...t,
          currentPrice:          s.price          || t.currentPrice,
          volume24h:             s.volume          || t.volume24h,
          trades:                s.trades          || t.trades,
          holders:               s.holders         || t.holders,
          marketCap:             s.marketCap        || t.marketCap,
          priceChange5m:         s.priceChange5m   ?? t.priceChange5m,
          priceChange1h:         s.priceChange1h   ?? t.priceChange1h,
          buyPressurePct:        s.buyPressurePct  ?? t.buyPressurePct,
          washScore:             s.washScore       ?? t.washScore,
          bondingCurveProgress:  s.bondingCurveProgress ?? t.bondingCurveProgress,
        };
      }));
    } catch { /* silent */ }
  }, []);

  // ─── Fetch: New Launches ─────────────────────────────────────────────────────
  const fetchNew = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoadingNew(true);
    try {
      const res = await fetch("/api/new-tokens?limit=50");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      // Tag all new tokens as unscanned — they show rug signal badge
      const raw: NewToken[] = (data.tokens ?? []).map((t: NewToken) => ({ ...t, unscanned: true }));
      setNewTokens(raw);
      setLastUpdated(new Date());
      // Enrich with price/volume/signals from batch-stats (non-blocking)
      enrichWithBatchStats(raw, setNewTokens);
    } catch (err) {
      console.error("[new-tokens]", err);
    } finally {
      setLoadingNew(false);
      setRefreshing(false);
    }
  }, [enrichWithBatchStats]);

  // ─── Fetch: Movers ────────────────────────────────────────────────────────────
  // Sources (merged + deduplicated):
  //   1. /api/dexscreener-gainers — DexScreener featured/boosted Solana tokens sorted by 24h gain
  //   2. /api/phantom-trending    — GeckoTerminal Solana trending pools (same DEXes Phantom uses)
  // Only these are rug-scanned. New launches remain unscanned.
  const fetchMovers = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoadingMovers(true);
    try {
      const [dsRes, phantomRes] = await Promise.allSettled([
        fetch("/api/dexscreener-gainers"),
        fetch("/api/phantom-trending"),
      ]);

      let dsGainers: NewToken[]    = [];
      let phantomTrending: NewToken[] = [];

      if (dsRes.status === "fulfilled" && dsRes.value.ok) {
        const data = await dsRes.value.json();
        dsGainers = data.tokens ?? [];
      }
      if (phantomRes.status === "fulfilled" && phantomRes.value.ok) {
        const data = await phantomRes.value.json();
        phantomTrending = data.tokens ?? [];
      }

      // Merge: DexScreener gainers first (top movers), then Phantom trending
      // Deduplicate by address — first occurrence wins
      const seen = new Set<string>();
      const combined: NewToken[] = [];
      for (const t of [...dsGainers, ...phantomTrending]) {
        if (!seen.has(t.address)) {
          seen.add(t.address);
          combined.push(t);
        }
      }

      // Preserve already-scanned scores when refreshing
      setMoverTokens((prev) => {
        const prevScores = Object.fromEntries(prev.map((t) => [t.address, t.rugScore]));
        return combined.map((t) => ({
          ...t,
          rugScore: scannedRef.current.has(t.address)
            ? (prevScores[t.address] ?? t.rugScore)
            : t.rugScore,
        }));
      });

      runRugScans(combined);
    } catch (err) {
      console.error("[movers]", err);
    } finally {
      setLoadingMovers(false);
    }
  }, [runRugScans]);

  // ─── Initial load + refresh intervals ────────────────────────────────────────
  useEffect(() => {
    fetchNew();
    fetchMovers();

    const newId    = setInterval(() => fetchNew(true),    30_000);
    const moversId = setInterval(() => fetchMovers(true), 60_000);

    return () => {
      clearInterval(newId);
      clearInterval(moversId);
    };
  }, [fetchNew, fetchMovers]);

  const handleSelect = (token: NewToken) => {
    sessionStorage.setItem(`token_meta_${token.address}`, JSON.stringify(token));
    router.push(`/terminal/${token.address}`);
  };

  const handleRefresh = () => {
    if (tab === "new") { fetchNew(true); return; }
    fetchMovers(true);
  };

  // ─── Derive tokens for active tab ────────────────────────────────────────────
  const scanned = scannedRef.current;

  const baseTokens: NewToken[] = (() => {
    switch (tab) {
      case "new":
        return newTokens;

      case "movers":
        return [...moverTokens].sort((a, b) =>
          moverSort === "gainers"
            ? b.priceChange5m - a.priceChange5m
            : b.volume24h - a.volume24h
        );

      case "safe":
        return moverTokens
          .filter((t) => scanned.has(t.address) && t.rugScore >= 70)
          .sort((a, b) =>
            moverSort === "gainers"
              ? b.priceChange5m - a.priceChange5m
              : b.volume24h - a.volume24h
          );

      case "medium":
        return moverTokens
          .filter((t) => scanned.has(t.address) && t.rugScore >= 40 && t.rugScore < 70)
          .sort((a, b) => b.volume24h - a.volume24h);

      case "rug": {
        // Movers that scanned as rug (worst first)
        const rugMovers = moverTokens
          .filter((t) => scanned.has(t.address) && t.rugScore < 40)
          .sort((a, b) => a.rugScore - b.rugScore);
        // Add new launches that aren't already in rugMovers
        const rugMoverAddresses = new Set(rugMovers.map((t) => t.address));
        const unscannedNew = newTokens.filter((t) => !rugMoverAddresses.has(t.address));
        return [...unscannedNew, ...rugMovers];
      }
    }
  })();

  const filtered = baseTokens
    .filter((t) => {
      const q = search.toLowerCase();
      if (!q) return true;
      return (
        t.symbol.toLowerCase().includes(q) ||
        t.name.toLowerCase().includes(q)   ||
        t.address.includes(q)
      );
    })
    // Pinned tokens float to the top
    .sort((a, b) => {
      const ap = pinnedAddresses.has(a.address) ? 0 : 1;
      const bp = pinnedAddresses.has(b.address) ? 0 : 1;
      return ap - bp;
    });

  const isLoading =
    (tab === "new"    && loadingNew)    ||
    (tab === "movers" && loadingMovers) ||
    ((tab === "safe" || tab === "medium") && loadingMovers) ||
    (tab === "rug"    && (loadingNew || loadingMovers));

  const activeColor = TAB_COLORS[tab];

  const tabLabel = {
    new:    "new launches",
    movers: "movers (DexScreener + Phantom)",
    safe:   "safe tokens",
    medium: "medium risk",
    rug:    "rug signals",
  }[tab];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-bold text-[#e6edf3]">Token Discovery</h1>
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#1e2530] border border-[#30363d]">
            <LiveDot color="green" />
            <span className="text-[10px] text-[#8b949e]">LIVE</span>
          </div>
          {lastUpdated && (
            <span className="text-[10px] text-[#484f58]">
              {Math.round((Date.now() - lastUpdated.getTime()) / 1000)}s ago
            </span>
          )}
          {scanProgress && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#3d2f0a] border border-[#d29922]/40">
              <Shield size={11} className="text-[#d29922] animate-pulse" />
              <span className="text-[10px] text-[#d29922] font-mono">
                Scanning {scanProgress.done}/{scanProgress.total}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing || isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[#30363d] text-xs text-[#8b949e] hover:border-[#484f58] hover:text-[#e6edf3] transition-all disabled:opacity-50"
        >
          <RefreshCw size={12} className={(refreshing || isLoading) ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Source tabs + search row */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {/* Source tabs */}
        <div className="flex items-center bg-[#161b22] border border-[#30363d] rounded p-1 gap-0.5">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              title={TABS.find((t) => t.id === id)?.desc}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all",
                tab === id
                  ? `bg-[#1e2530] ${TAB_COLORS[id]}`
                  : "text-[#8b949e] hover:text-[#e6edf3]"
              )}
            >
              {icon}
              {label}
              {(id === "safe" || id === "medium" || id === "rug") && scanProgress && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#d29922] animate-pulse" />
              )}
            </button>
          ))}
        </div>

        {/* Sort toggle for movers/safe tabs */}
        {(tab === "movers" || tab === "safe" || tab === "medium") && (
          <div className="flex items-center bg-[#161b22] border border-[#30363d] rounded p-1 gap-0.5">
            <button
              onClick={() => setMoverSort("gainers")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all",
                moverSort === "gainers" ? "bg-[#1e2530] text-[#3fb950]" : "text-[#8b949e] hover:text-[#e6edf3]"
              )}
            >
              <TrendingUp size={11} /> Gainers
            </button>
            <button
              onClick={() => setMoverSort("volume")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-all",
                moverSort === "volume" ? "bg-[#1e2530] text-[#58a6ff]" : "text-[#8b949e] hover:text-[#e6edf3]"
              )}
            >
              <BarChart2 size={11} /> Volume
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58]" />
          <input
            type="text"
            placeholder="Search symbol, name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded pl-8 pr-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>
      </div>

      {/* Count row */}
      <div className="flex items-center gap-2 mb-3">
        {pinnedAddresses.size > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-[#58a6ff] bg-[#1e2530] border border-[#58a6ff]/30 px-1.5 py-0.5 rounded">
            <Pin size={9} />
            {pinnedAddresses.size} pinned
          </span>
        )}
        <p className={cn("text-[11px]", activeColor)}>
          {filtered.length} {tabLabel}
          {tab === "rug" && !search && (
            <span className="text-[#484f58]">
              {" "}({newTokens.length} unscanned new
              {moverTokens.filter((t) => scanned.has(t.address) && t.rugScore < 40).length > 0
                ? ` + ${moverTokens.filter((t) => scanned.has(t.address) && t.rugScore < 40).length} scanned`
                : ""})
            </span>
          )}
          {search ? ` matching "${search}"` : ""}
        </p>
        {(tab === "safe" || tab === "medium") && !scanProgress && filtered.length === 0 && moverTokens.length > 0 && (
          <span className="text-[10px] text-[#484f58]">— rug scanning in progress…</span>
        )}
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center flex-1 gap-2 text-sm text-[#8b949e]">
          <Spinner size={20} />
          Loading {tab === "new" ? "new launches" : "movers"}…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-2 text-[#484f58] text-sm">
          <p>
            {tab === "safe" || tab === "medium"
              ? scanProgress
                ? "Scanning movers…"
                : "No tokens in this category yet — scanning in progress"
              : "No tokens found"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto pb-4">
          {filtered.map((t) => (
            <TokenCard
              key={t.address}
              token={t}
              onSelect={handleSelect}
              pinned={pinnedAddresses.has(t.address)}
              onPin={togglePin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
