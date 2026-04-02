"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Loader2, ExternalLink, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchResult } from "@/app/api/search/route";

const NETWORK_STYLES: Record<string, string> = {
  solana:   "text-[#9945ff] bg-[#9945ff]/10 border-[#9945ff]/30",
  eth:      "text-[#627eea] bg-[#627eea]/10 border-[#627eea]/30",
  bsc:      "text-[#f3ba2f] bg-[#f3ba2f]/10 border-[#f3ba2f]/30",
  base:     "text-[#0052ff] bg-[#0052ff]/10 border-[#0052ff]/30",
  arbitrum: "text-[#28a0f0] bg-[#28a0f0]/10 border-[#28a0f0]/30",
  matic:    "text-[#8247e5] bg-[#8247e5]/10 border-[#8247e5]/30",
  optimism: "text-[#ff0420] bg-[#ff0420]/10 border-[#ff0420]/30",
  tron:     "text-[#ef0027] bg-[#ef0027]/10 border-[#ef0027]/30",
};

const TYPE_STYLES: Record<string, string> = {
  token:  "text-[#3fb950]",
  pool:   "text-[#58a6ff]",
  trader: "text-[#d29922]",
};

// Min length before querying — Solana addresses are 44 chars, EVM are 42
const MIN_QUERY_LEN = 32;

export function GlobalSearch() {
  const router = useRouter();
  const [query,   setQuery]   = useState("");
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error,   setError]   = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const inputRef    = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Run search ─────────────────────────────────────────────────────────────
  const runSearch = useCallback(async (address: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error("failed");
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setError("Search failed — check the address");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Debounced trigger ──────────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length < MIN_QUERY_LEN) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(() => runSearch(query), 600);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  // ── Close on outside click ─────────────────────────────────────────────────
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  const handleSelect = (r: SearchResult) => {
    if (r.navigable) {
      router.push(`/terminal/${r.address}`);
      setOpen(false);
      setQuery("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const showDropdown = open && query.length >= MIN_QUERY_LEN;
  const isExpanded   = focused || query.length > 0;

  return (
    <div ref={containerRef} className="relative">
      {/* Input */}
      <div className={cn(
        "flex items-center gap-1.5 bg-[#161b22] border rounded transition-all duration-200",
        isExpanded ? "border-[#58a6ff]/60 w-72" : "border-[#30363d] hover:border-[#484f58] w-52"
      )}>
        {loading
          ? <Loader2 size={13} className="shrink-0 ml-2.5 text-[#8b949e] animate-spin" />
          : <Search size={13} className="shrink-0 ml-2.5 text-[#484f58]" />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { setFocused(true); setOpen(true); }}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Search token, pool, wallet…"
          className="flex-1 bg-transparent py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none min-w-0"
        />
        {query && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setQuery(""); setResults([]); }}
            className="pr-2 text-[#484f58] hover:text-[#8b949e]"
          >
            <X size={11} />
          </button>
        )}
      </div>

      {/* Hint below input when focused but not enough chars */}
      {open && query.length > 0 && query.length < MIN_QUERY_LEN && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-[10px] text-[#484f58] z-50">
          Paste a full token address, pool address, or wallet to search…
          <span className="text-[#8b949e] font-mono ml-1">({query.length}/{MIN_QUERY_LEN} chars)</span>
        </div>
      )}

      {/* Results dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 w-80 bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#21262d]">
            <span className="text-[10px] text-[#484f58]">
              {loading
                ? "Searching across 8 chains…"
                : `${results.length} result${results.length !== 1 ? "s" : ""} found`}
            </span>
            {loading && <Loader2 size={10} className="animate-spin text-[#8b949e]" />}
          </div>

          {/* Body */}
          <div className="max-h-72 overflow-y-auto">
            {!loading && error && (
              <div className="px-3 py-3 text-xs text-[#f85149]">{error}</div>
            )}
            {!loading && !error && results.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[#484f58]">
                No matches found across any chain
              </div>
            )}
            {results.map((r, i) => (
              <div
                key={i}
                onClick={() => handleSelect(r)}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 border-b border-[#21262d] last:border-0 transition-colors",
                  r.navigable
                    ? "cursor-pointer hover:bg-[#1e2530]"
                    : "cursor-default"
                )}
              >
                {/* Network badge */}
                <span className={cn(
                  "shrink-0 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border",
                  NETWORK_STYLES[r.network] ?? "text-[#8b949e] bg-[#1e2530] border-[#30363d]"
                )}>
                  {r.network}
                </span>

                {/* Type icon + label */}
                <span className={cn("shrink-0 text-[9px] font-mono uppercase w-10", TYPE_STYLES[r.type] ?? "text-[#484f58]")}>
                  {r.type === "trader" ? <Wallet size={10} className="inline" /> : r.type}
                </span>

                {/* Token info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs font-bold text-[#e6edf3] truncate">{r.symbol}</span>
                    {r.name && r.name !== r.symbol && (
                      <span className="text-[10px] text-[#8b949e] truncate">{r.name}</span>
                    )}
                  </div>
                  {r.dex && (
                    <div className="text-[9px] text-[#484f58] truncate">{r.dex}</div>
                  )}
                </div>

                {/* Action */}
                {r.navigable ? (
                  <div className="shrink-0 flex items-center gap-1 text-[10px] text-[#58a6ff]">
                    Trade <ExternalLink size={9} />
                  </div>
                ) : (
                  <span className="shrink-0 text-[9px] text-[#484f58]">view only</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
