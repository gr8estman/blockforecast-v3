"use client";

import { useState }          from "react";
import { useRouter }         from "next/navigation";
import Link                  from "next/link";
import { ArrowLeft, Loader2, TrendingUp } from "lucide-react";
import { useWalletStore }    from "@/store/walletStore";
import { Category }          from "@/lib/prediction/types";
import { cn }                from "@/lib/utils";

const CATEGORIES: { key: Category; label: string; desc: string }[] = [
  { key: "price",      label: "Price",      desc: "Will token hit a price target?" },
  { key: "rug",        label: "Rug",        desc: "Will this token rug or exit scam?" },
  { key: "graduation", label: "Graduation", desc: "Will token graduate bonding curve?" },
  { key: "custom",     label: "Custom",     desc: "Any yes/no question" },
];

const QUICK_DURATIONS = [
  { label: "1h",  ms: 60 * 60 * 1000          },
  { label: "4h",  ms: 4  * 60 * 60 * 1000     },
  { label: "24h", ms: 24 * 60 * 60 * 1000     },
  { label: "3d",  ms: 3  * 24 * 60 * 60 * 1000 },
  { label: "7d",  ms: 7  * 24 * 60 * 60 * 1000 },
];

export default function CreateMarketPage() {
  const router = useRouter();
  const { phantomAddress, generated } = useWalletStore();
  const walletAddress = phantomAddress ?? generated?.publicKey ?? null;

  const [question,    setQuestion]    = useState("");
  const [description, setDescription] = useState("");
  const [category,    setCategory]    = useState<Category>("custom");
  const [token,       setToken]       = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [endTime,     setEndTime]     = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  function applyDuration(ms: number) {
    const dt = new Date(Date.now() + ms);
    // Format for datetime-local input
    const local = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setEndTime(local);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress) { setError("Connect your wallet first"); return; }
    if (!question.trim()) { setError("Question is required"); return; }
    if (!endTime) { setError("End time is required"); return; }

    setLoading(true);
    setError("");

    try {
      const res  = await fetch("/api/markets", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          question:    question.trim(),
          description: description.trim() || undefined,
          category,
          token:       token.trim()       || undefined,
          tokenSymbol: tokenSymbol.trim() || undefined,
          creator:     walletAddress,
          endTime:     new Date(endTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create market");
      router.push(`/markets/${data.market.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto max-w-2xl mx-auto px-4 py-6">
      <Link href="/markets" className="flex items-center gap-1.5 text-[#8b949e] hover:text-[#e6edf3] text-sm mb-6 transition-colors w-fit">
        <ArrowLeft size={14} /> Back to Markets
      </Link>

      <div className="flex items-center gap-2 mb-6">
        <TrendingUp size={18} className="text-[#58a6ff]" />
        <h1 className="text-lg font-bold text-[#e6edf3]">Create Prediction Market</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Category */}
        <div>
          <label className="text-[12px] text-[#8b949e] mb-2 block font-medium">Category</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORIES.map(({ key, label, desc }) => (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(key)}
                className={cn(
                  "p-3 rounded-lg border text-left transition-all",
                  category === key
                    ? "bg-[#1e2d3d] border-[#58a6ff] text-[#e6edf3]"
                    : "bg-[#161b22] border-[#21262d] text-[#8b949e] hover:border-[#30363d]",
                )}
              >
                <div className="text-[12px] font-semibold">{label}</div>
                <div className="text-[10px] mt-0.5 opacity-70">{desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Question */}
        <div>
          <label className="text-[12px] text-[#8b949e] mb-1 block font-medium">
            Question <span className="text-[#f85149]">*</span>
          </label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder='e.g. "Will $PEPE reach $0.001 by Friday?"'
            maxLength={200}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff]"
          />
          <p className="text-[10px] text-[#484f58] mt-1 text-right">{question.length}/200</p>
        </div>

        {/* Description */}
        <div>
          <label className="text-[12px] text-[#8b949e] mb-1 block font-medium">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Resolution criteria — how will you determine YES vs NO?"
            rows={3}
            maxLength={500}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] resize-none"
          />
        </div>

        {/* Token (optional) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] text-[#8b949e] mb-1 block font-medium">Token mint (optional)</label>
            <input
              type="text"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Mint address…"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] font-mono"
            />
          </div>
          <div>
            <label className="text-[12px] text-[#8b949e] mb-1 block font-medium">Symbol (optional)</label>
            <input
              type="text"
              value={tokenSymbol}
              onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
              placeholder="PEPE"
              maxLength={12}
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder:text-[#484f58] focus:outline-none focus:border-[#58a6ff] font-mono"
            />
          </div>
        </div>

        {/* End time */}
        <div>
          <label className="text-[12px] text-[#8b949e] mb-1 block font-medium">
            Betting closes at <span className="text-[#f85149]">*</span>
          </label>
          <div className="flex gap-2 flex-wrap mb-2">
            {QUICK_DURATIONS.map(({ label, ms }) => (
              <button
                key={label}
                type="button"
                onClick={() => applyDuration(ms)}
                className="px-2.5 py-1 bg-[#21262d] rounded text-[11px] text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              >
                +{label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] focus:outline-none focus:border-[#58a6ff]"
          />
        </div>

        {/* Info box */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg p-3 text-[11px] text-[#8b949e] space-y-1">
          <p>• Parimutuel pool — winners split the losers&apos; pool proportionally.</p>
          <p>• Platform fee: 2% on winnings (creator gets 0% — add creator fee later).</p>
          <p>• You resolve the market manually after the end time.</p>
        </div>

        {!walletAddress && (
          <p className="text-[12px] text-[#d29922] bg-[#2d2213] border border-[#d29922]/30 rounded p-2">
            Connect your wallet to create a market.
          </p>
        )}

        {error && <p className="text-[12px] text-[#f85149]">{error}</p>}

        <button
          type="submit"
          disabled={loading || !walletAddress}
          className="w-full py-3 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Create Market
        </button>
      </form>
    </div>
  );
}
