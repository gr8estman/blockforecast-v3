"use client";

import { useEffect, useState, useCallback } from "react";
import Link                                 from "next/link";
import { Plus, TrendingUp, Filter, RefreshCw } from "lucide-react";
import { MarketCard }  from "@/components/markets/MarketCard";
import { Market }      from "@/lib/prediction/types";
import { cn }          from "@/lib/utils";

type Filter = "all" | "open" | "resolved" | "price" | "rug" | "graduation" | "custom";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all",        label: "All"        },
  { key: "open",       label: "Open"       },
  { key: "resolved",   label: "Resolved"   },
  { key: "price",      label: "Price"      },
  { key: "rug",        label: "Rug"        },
  { key: "graduation", label: "Graduation" },
  { key: "custom",     label: "Custom"     },
];

export default function MarketsPage() {
  const [markets,  setMarkets]  = useState<Market[]>([]);
  const [filter,   setFilter]   = useState<Filter>("all");
  const [loading,  setLoading]  = useState(true);

  const fetchMarkets = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "open" || filter === "resolved") params.set("status", filter);
      else if (filter !== "all") params.set("category", filter);

      const res  = await fetch(`/api/markets?${params}`);
      const data = await res.json();
      setMarkets(data.markets ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchMarkets(); }, [fetchMarkets]);

  const totalPool = markets.reduce((s, m) => s + m.yesPool + m.noPool, 0);
  const openCount = markets.filter((m) => m.status === "open").length;

  return (
    <div className="h-full overflow-y-auto max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[#e6edf3] flex items-center gap-2">
            <TrendingUp size={20} className="text-[#58a6ff]" />
            Prediction Markets
          </h1>
          <p className="text-[12px] text-[#8b949e] mt-1">
            {openCount} open · {totalPool.toFixed(2)} SOL total volume
          </p>
        </div>
        <Link
          href="/markets/create"
          className="flex items-center gap-1.5 px-3 py-2 bg-[#238636] hover:bg-[#2ea043] text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={14} />
          Create Market
        </Link>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <Filter size={13} className="text-[#8b949e]" />
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-all",
              filter === key
                ? "bg-[#1f6feb] text-[#e6edf3]"
                : "bg-[#161b22] text-[#8b949e] hover:text-[#e6edf3] border border-[#21262d]",
            )}
          >
            {label}
          </button>
        ))}
        <button
          onClick={fetchMarkets}
          className="ml-auto p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 h-40 animate-pulse" />
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-20 text-[#8b949e]">
          <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No markets yet</p>
          <Link href="/markets/create" className="text-[#58a6ff] text-sm hover:underline mt-2 inline-block">
            Create the first one →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((m) => <MarketCard key={m.id} market={m} />)}
        </div>
      )}
    </div>
  );
}
