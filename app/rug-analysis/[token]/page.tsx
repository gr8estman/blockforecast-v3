"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { RugCheckResult } from "@/types";
import { RugAnalysisPanel } from "@/components/rug/RugAnalysisPanel";
import { Spinner, Button, Badge } from "@/components/ui";
import { rugScoreColor, rugScoreLabel, shortAddress } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, BarChart2, RefreshCw, Shield, AlertTriangle
} from "lucide-react";
import Link from "next/link";

export default function RugAnalysisPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [result, setResult] = useState<RugCheckResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rug-check/${token}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RugCheckResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="h-full overflow-y-auto max-w-3xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 rounded bg-[#161b22] border border-[#30363d] hover:border-[#484f58] text-[#8b949e] hover:text-[#e6edf3] transition-all"
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Shield size={18} className="text-[#58a6ff]" />
              <h1 className="text-lg font-bold text-[#e6edf3]">Rug Analysis</h1>
              {result && (
                <Badge
                  variant={
                    result.overallScore >= 70 ? "green" :
                    result.overallScore >= 40 ? "yellow" :
                    "red"
                  }
                >
                  {rugScoreLabel(result.overallScore)}
                </Badge>
              )}
            </div>
            <p className="text-xs text-[#484f58] font-mono mt-0.5">
              {shortAddress(token ?? "", 8)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={runCheck}
            loading={loading}
          >
            <RefreshCw size={13} />
            Re-analyze
          </Button>
          <Link href={`/terminal/${token}`}>
            <Button variant="primary" size="sm">
              <BarChart2 size={13} />
              Open Terminal
            </Button>
          </Link>
        </div>
      </div>

      {/* Risk Banner — show prominently if rug */}
      {result && result.riskLevel === "rug" && (
        <div className="flex items-center gap-3 p-4 bg-[#3d1a1a] border border-[#f85149]/50 rounded-lg mb-6">
          <AlertTriangle size={20} className="text-[#f85149] shrink-0" />
          <div>
            <p className="text-sm font-bold text-[#f85149]">
              HIGH RUG RISK — Do NOT trade this token
            </p>
            <p className="text-xs text-[#8b949e] mt-0.5">
              Multiple indicators of malicious token behavior detected.
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Spinner size={32} />
          <div className="text-center">
            <p className="text-[#e6edf3] font-medium">Running full rug analysis…</p>
            <p className="text-xs text-[#8b949e] mt-1">
              Checking holder distribution, wash trading, pre-distribution & liquidity
            </p>
          </div>
          <div className="flex flex-col gap-1.5 w-56">
            {[
              "Fetching top holders",
              "Detecting wash trading",
              "Checking pre-distribution",
              "Verifying graduation",
            ].map((step, i) => (
              <div key={step} className="flex items-center gap-2 text-xs text-[#484f58]">
                <Spinner size={10} className="opacity-60" />
                {step}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <AlertTriangle size={32} className="text-[#f85149]" />
          <div>
            <p className="text-[#f85149] font-medium">Analysis failed</p>
            <p className="text-xs text-[#8b949e] mt-1">{error}</p>
          </div>
          <Button variant="outline" onClick={runCheck}>
            Try again
          </Button>
        </div>
      )}

      {/* Results */}
      {result && !loading && <RugAnalysisPanel result={result} />}
    </div>
  );
}
