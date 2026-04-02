"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import {
  Crosshair, Zap, Wifi, WifiOff, Settings2, Trash2,
  ExternalLink, Shield, Copy, CheckCheck, BarChart2,
  TrendingUp, AlertTriangle, CircleDot,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatUsd, shortAddress, timeAgo } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SniperToken {
  mint:          string;
  symbol:        string;
  name:          string;
  uri:           string;
  dex:           string;
  traderWallet:  string;
  timestamp:     number;
  slot:          number;
  txSignature:   string;
  detectedAt:    number;  // local time we received the event
}

type KafkaStatus = "connected" | "connecting" | "disconnected";
type ArmState    = "armed" | "safe";
type Priority    = "fast" | "turbo" | "warp";

const MAX_FEED = 200;

const PRIORITY_LABELS: Record<Priority, string> = {
  fast:  "Fast  (~100k μL)",
  turbo: "Turbo (~500k μL)",
  warp:  "Warp  (~1.5M μL)",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SniperPage() {
  // ── Config state ─────────────────────────────────────────────────────────
  const [armState,   setArmState]   = useState<ArmState>("safe");
  const [buyAmount,  setBuyAmount]  = useState("0.1");
  const [slippage,   setSlippage]   = useState("15");
  const [priority,   setPriority]   = useState<Priority>("turbo");
  const [autoBuy,    setAutoBuy]    = useState(false);
  const [maxAge,     setMaxAge]     = useState("60");  // seconds — ignore tokens older than this

  // ── Stream state ──────────────────────────────────────────────────────────
  const [kafkaStatus, setKafkaStatus] = useState<KafkaStatus>("connecting");
  const [feed,        setFeed]        = useState<SniperToken[]>([]);
  const [totalSeen,   setTotalSeen]   = useState(0);
  const [paused,      setPaused]      = useState(false);

  // ── Snipe queue state ─────────────────────────────────────────────────────
  const [sniping,     setSniping]     = useState<Set<string>>(new Set());
  const [sniped,      setSniped]      = useState<Map<string, string>>(new Map()); // mint → txHash

  // ── Copy toast ────────────────────────────────────────────────────────────
  const [copied, setCopied] = useState<string | null>(null);

  const esRef       = useRef<EventSource | null>(null);
  const feedRef     = useRef<SniperToken[]>([]);
  const pausedRef   = useRef(false);

  // Keep refs in sync
  feedRef.current   = feed;
  pausedRef.current = paused;

  // ── SSE connection ────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }

    const es = new EventSource("/api/sniper-feed");
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === "status") {
          setKafkaStatus(msg.status as KafkaStatus);
          return;
        }

        if (msg.type !== "new_token") return;

        setTotalSeen((n) => n + 1);
        if (pausedRef.current) return;

        const token: SniperToken = {
          mint:         msg.mint,
          symbol:       msg.symbol || "???",
          name:         msg.name   || "",
          uri:          msg.uri    || "",
          dex:          msg.dex    || "pump.fun",
          traderWallet: msg.traderWallet || "",
          timestamp:    msg.timestamp,
          slot:         msg.slot,
          txSignature:  msg.txSignature,
          detectedAt:   Date.now(),
        };

        setFeed((prev) => [token, ...prev].slice(0, MAX_FEED));
      } catch { /* ignore parse errors */ }
    };

    es.onerror = () => {
      setKafkaStatus("disconnected");
      es.close();
      esRef.current = null;
      setTimeout(connect, 5_000);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => { esRef.current?.close(); };
  }, [connect]);

  // ── Snipe a token ─────────────────────────────────────────────────────────
  const handleSnipe = useCallback(async (token: SniperToken) => {
    if (sniping.has(token.mint)) return;

    // Get private key from localStorage (paper trade or real wallet)
    const secretKey =
      typeof window !== "undefined"
        ? localStorage.getItem("bf_generated_sk") ?? ""
        : "";

    if (!secretKey) {
      alert("No wallet found — generate one on the Portfolio page first.");
      return;
    }

    setSniping((prev) => new Set([...prev, token.mint]));

    try {
      const res = await fetch("/api/snipe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenAddress: token.mint,
          solAmount:    parseFloat(buyAmount)  || 0.1,
          slippage:     parseFloat(slippage)   || 15,
          secretKey,
          priorityLevel:
            priority === "fast"  ? "medium"   :
            priority === "turbo" ? "high"      : "veryHigh",
        }),
      });
      const data = await res.json();
      if (data.txHash) {
        setSniped((prev) => new Map(prev).set(token.mint, data.txHash));
      } else {
        alert(`Snipe failed: ${data.error ?? "unknown error"}`);
      }
    } catch (err) {
      alert(`Snipe error: ${String(err)}`);
    } finally {
      setSniping((prev) => {
        const next = new Set(prev);
        next.delete(token.mint);
        return next;
      });
    }
  }, [buyAmount, slippage, priority, sniping]);

  // ── Copy helper ───────────────────────────────────────────────────────────
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  };

  // ── Clear feed ────────────────────────────────────────────────────────────
  const clearFeed = () => {
    setFeed([]);
    setTotalSeen(0);
  };

  // ─────────────────────────────────────────────────────────────────────────

  const statusColor: Record<KafkaStatus, string> = {
    connected:    "text-[#3fb950]",
    connecting:   "text-[#d29922]",
    disconnected: "text-[#f85149]",
  };

  const StatusIcon =
    kafkaStatus === "connected"    ? Wifi    :
    kafkaStatus === "connecting"   ? CircleDot : WifiOff;

  return (
    <div className="flex flex-col h-full gap-4 p-4 overflow-hidden">

      {/* ── Experimental Notice ── */}
      <div className="shrink-0 overflow-hidden rounded border border-yellow-500/30 bg-yellow-500/5">
        <div className="flex items-center gap-2 px-3 py-2 whitespace-nowrap animate-[marquee_18s_linear_infinite]">
          <AlertTriangle size={13} className="shrink-0 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-medium">
            EXPERIMENTAL &nbsp;—&nbsp; The Sniper is a new feature currently under active development. Auto-buy executes real transactions. Use small amounts, expect rough edges, and always verify before arming.
          </span>
          <AlertTriangle size={13} className="shrink-0 text-yellow-400" />
          <span className="text-xs text-yellow-400 font-medium">
            EXPERIMENTAL &nbsp;—&nbsp; The Sniper is a new feature currently under active development. Auto-buy executes real transactions. Use small amounts, expect rough edges, and always verify before arming.
          </span>
        </div>
      </div>

      {/* ── Header ── */}
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#f85149]/10 border border-[#f85149]/30 flex items-center justify-center">
            <Crosshair size={16} className="text-[#f85149]" />
          </div>
          <div>
            <h1 className="text-base font-bold text-[#e6edf3]">Sniper</h1>
            <p className="text-[10px] text-[#484f58]">Kafka Protobuf — sub-second pump.fun detection</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Kafka status */}
          <div className={cn("flex items-center gap-1.5 text-[11px] font-mono", statusColor[kafkaStatus])}>
            <StatusIcon size={12} className={kafkaStatus === "connecting" ? "animate-pulse" : ""} />
            {kafkaStatus.toUpperCase()}
          </div>

          {/* Total seen */}
          <div className="px-2 py-1 rounded bg-[#161b22] border border-[#30363d] text-[10px] text-[#8b949e] font-mono">
            {totalSeen.toLocaleString()} detected
          </div>

          {/* Arm toggle */}
          <button
            onClick={() => setArmState((s) => s === "safe" ? "armed" : "safe")}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded border text-xs font-bold transition-all",
              armState === "armed"
                ? "bg-[#f85149]/10 border-[#f85149] text-[#f85149] hover:bg-[#f85149]/20"
                : "bg-[#1e2530] border-[#30363d] text-[#8b949e] hover:border-[#484f58] hover:text-[#e6edf3]"
            )}
          >
            <Crosshair size={12} className={armState === "armed" ? "animate-pulse" : ""} />
            {armState === "armed" ? "ARMED" : "SAFE"}
          </button>
        </div>
      </div>

      {/* ── Config + Feed layout ── */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* ─ Config Panel ─ */}
        <div className="w-64 shrink-0 flex flex-col gap-3">
          <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-4 flex flex-col gap-4">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8b949e]">
              <Settings2 size={13} />
              Config
            </div>

            {/* Buy Amount */}
            <div>
              <label className="block text-[10px] text-[#484f58] mb-1">Buy Amount (SOL)</label>
              <div className="relative">
                <input
                  type="number"
                  min="0.01" step="0.01"
                  value={buyAmount}
                  onChange={(e) => setBuyAmount(e.target.value)}
                  className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-sm text-[#e6edf3] font-mono focus:outline-none focus:border-[#58a6ff]"
                />
              </div>
              <div className="flex gap-1 mt-1">
                {["0.05", "0.1", "0.25", "0.5"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setBuyAmount(v)}
                    className={cn(
                      "flex-1 text-[9px] py-0.5 rounded border transition-all",
                      buyAmount === v
                        ? "bg-[#58a6ff]/10 border-[#58a6ff] text-[#58a6ff]"
                        : "border-[#30363d] text-[#484f58] hover:text-[#8b949e]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* Slippage */}
            <div>
              <label className="block text-[10px] text-[#484f58] mb-1">Slippage %</label>
              <input
                type="number"
                min="1" max="99"
                value={slippage}
                onChange={(e) => setSlippage(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-sm text-[#e6edf3] font-mono focus:outline-none focus:border-[#58a6ff]"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-[10px] text-[#484f58] mb-1.5">Priority Fee</label>
              <div className="flex flex-col gap-1">
                {(["fast", "turbo", "warp"] as Priority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriority(p)}
                    className={cn(
                      "text-left px-2.5 py-1.5 rounded border text-[10px] font-mono transition-all",
                      priority === p
                        ? "bg-[#1e2530] border-[#58a6ff] text-[#58a6ff]"
                        : "border-[#30363d] text-[#484f58] hover:text-[#8b949e]"
                    )}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                    <span className="ml-2 text-[#484f58]">
                      {p === "fast"  ? "~100k μL" :
                       p === "turbo" ? "~500k μL" : "~1.5M μL"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Max age filter */}
            <div>
              <label className="block text-[10px] text-[#484f58] mb-1">Max token age (s)</label>
              <input
                type="number"
                min="10" max="3600"
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                className="w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-sm text-[#e6edf3] font-mono focus:outline-none focus:border-[#58a6ff]"
              />
              <p className="text-[9px] text-[#484f58] mt-1">Ignore tokens older than this</p>
            </div>

            {/* Auto-buy toggle */}
            <div className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded border transition-all",
              autoBuy
                ? "bg-[#f85149]/10 border-[#f85149]/50"
                : "border-[#30363d] bg-[#161b22]"
            )}>
              <div>
                <p className={cn("text-xs font-semibold", autoBuy ? "text-[#f85149]" : "text-[#8b949e]")}>
                  Auto-buy
                </p>
                <p className="text-[9px] text-[#484f58]">Snipe instantly on detection</p>
              </div>
              <button
                onClick={() => {
                  if (!autoBuy && armState !== "armed") {
                    alert("Arm the sniper first before enabling auto-buy.");
                    return;
                  }
                  setAutoBuy((v) => !v);
                }}
                className={cn(
                  "w-10 h-5 rounded-full border relative transition-all",
                  autoBuy
                    ? "bg-[#f85149] border-[#f85149]"
                    : "bg-[#161b22] border-[#30363d]"
                )}
              >
                <span className={cn(
                  "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all",
                  autoBuy ? "left-5" : "left-0.5"
                )} />
              </button>
            </div>

            {armState === "armed" && autoBuy && (
              <div className="px-2 py-1.5 bg-[#3d1a1a] rounded border border-[#f85149]/30 text-[10px] text-[#f85149]">
                ⚠ Auto-buy ACTIVE — spending {buyAmount} SOL per launch
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-3 grid grid-cols-2 gap-2">
            {[
              { label: "Detected",  value: totalSeen.toLocaleString(), icon: <Zap size={11} /> },
              { label: "In feed",   value: feed.length,                icon: <BarChart2 size={11} /> },
              { label: "Sniped",    value: sniped.size,                icon: <Crosshair size={11} /> },
              { label: "Mode",      value: armState.toUpperCase(),     icon: <Shield size={11} /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-[#161b22] rounded p-2">
                <div className="flex items-center gap-1 text-[#484f58] mb-0.5">{icon}<span className="text-[9px]">{label}</span></div>
                <p className="text-xs font-mono font-bold text-[#e6edf3]">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ─ Feed ─ */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Feed toolbar */}
          <div className="flex items-center justify-between mb-2 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#8b949e] font-semibold">Live Feed</span>
              {kafkaStatus === "connected" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] animate-pulse" />
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPaused((v) => !v)}
                className={cn(
                  "text-[10px] px-2 py-1 rounded border transition-all",
                  paused
                    ? "bg-[#d29922]/10 border-[#d29922] text-[#d29922]"
                    : "border-[#30363d] text-[#484f58] hover:text-[#8b949e]"
                )}
              >
                {paused ? "▶ Resume" : "⏸ Pause"}
              </button>
              <button
                onClick={clearFeed}
                className="flex items-center gap-1 text-[10px] px-2 py-1 rounded border border-[#30363d] text-[#484f58] hover:text-[#f85149] hover:border-[#f85149]/40 transition-all"
              >
                <Trash2 size={10} /> Clear
              </button>
            </div>
          </div>

          {/* Feed list */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {feed.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-2 text-[#484f58]">
                <Crosshair size={28} className={kafkaStatus === "connected" ? "animate-pulse" : ""} />
                <p className="text-sm">
                  {kafkaStatus === "connecting" ? "Connecting to Kafka stream…" :
                   kafkaStatus === "connected"  ? "Waiting for new pump.fun launches…" :
                   "Kafka disconnected — check credentials in .env.local"}
                </p>
              </div>
            ) : (
              feed.map((token) => {
                const isSniping = sniping.has(token.mint);
                const txHash    = sniped.get(token.mint);
                const ageMs     = Date.now() - token.detectedAt;
                const ageSec    = Math.floor(ageMs / 1000);
                const tooOld    = ageSec > (parseInt(maxAge) || 60);

                return (
                  <div
                    key={`${token.mint}-${token.detectedAt}`}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg border transition-all",
                      txHash
                        ? "bg-[#0d2a1a] border-[#3fb950]/30"
                        : tooOld
                        ? "bg-[#0d1117] border-[#21262d] opacity-50"
                        : "bg-[#0d1117] border-[#21262d] hover:border-[#30363d]"
                    )}
                  >
                    {/* Symbol */}
                    <div className="w-8 h-8 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center text-[10px] font-bold text-[#58a6ff] shrink-0">
                      {token.symbol.slice(0, 2)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#e6edf3] truncate">{token.symbol}</span>
                        {token.name && (
                          <span className="text-[10px] text-[#484f58] truncate">{token.name}</span>
                        )}
                        <span className={cn(
                          "text-[9px] font-mono ml-auto shrink-0",
                          ageSec < 5  ? "text-[#3fb950]" :
                          ageSec < 30 ? "text-[#d29922]" : "text-[#484f58]"
                        )}>
                          {ageSec < 2 ? "just now" : `${ageSec}s ago`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-[#484f58] font-mono">{shortAddress(token.mint, 4)}</span>
                        <span className="text-[9px] text-[#484f58]">{token.dex}</span>
                        {txHash && (
                          <span className="text-[9px] text-[#3fb950] font-semibold">✓ sniped</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => copyText(token.mint)}
                        className="p-1 rounded hover:bg-[#21262d] text-[#484f58] hover:text-[#8b949e] transition-all"
                        title="Copy mint"
                      >
                        {copied === token.mint ? <CheckCheck size={12} className="text-[#3fb950]" /> : <Copy size={12} />}
                      </button>

                      <Link
                        href={`/rug-analysis/${token.mint}`}
                        className="p-1 rounded hover:bg-[#21262d] text-[#484f58] hover:text-[#58a6ff] transition-all"
                        title="Rug analysis"
                      >
                        <Shield size={12} />
                      </Link>

                      <Link
                        href={`/terminal/${token.mint}`}
                        className="p-1 rounded hover:bg-[#21262d] text-[#484f58] hover:text-[#58a6ff] transition-all"
                        title="Open terminal"
                      >
                        <ExternalLink size={12} />
                      </Link>

                      {/* Snipe button */}
                      {!txHash && (
                        <button
                          disabled={isSniping || (armState !== "armed" && !autoBuy) || tooOld}
                          onClick={() => handleSnipe(token)}
                          className={cn(
                            "flex items-center gap-1 px-2.5 py-1 rounded border text-[10px] font-bold transition-all",
                            isSniping
                              ? "border-[#d29922] text-[#d29922] bg-[#d29922]/10 cursor-wait"
                              : armState === "armed" && !tooOld
                              ? "border-[#f85149] text-[#f85149] bg-[#f85149]/10 hover:bg-[#f85149]/20"
                              : "border-[#30363d] text-[#484f58] cursor-not-allowed opacity-50"
                          )}
                        >
                          <Crosshair size={10} className={isSniping ? "animate-spin" : ""} />
                          {isSniping ? "Sniping…" : "Snipe"}
                        </button>
                      )}

                      {txHash && (
                        <a
                          href={`https://solscan.io/tx/${txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-[#3fb950] hover:underline font-mono"
                        >
                          {shortAddress(txHash, 4)}
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom disclaimer ── */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-[#3d2f0a]/40 border border-[#d29922]/20 rounded-lg">
        <AlertTriangle size={12} className="text-[#d29922] shrink-0" />
        <p className="text-[10px] text-[#d29922]">
          Sniper trades are high-risk. New tokens are unscanned and likely to rug.
          Only use funds you can afford to lose completely.
          Auto-buy sends transactions without confirmation prompts.
        </p>
      </div>
    </div>
  );
}
