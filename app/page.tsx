"use client";

import { useState, useEffect } from "react";
import { TokenList } from "@/components/discovery/TokenList";
import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";

const DISCLAIMER_KEY = "bf_disclaimer_dismissed";

export default function HomePage() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Show once per session (sessionStorage resets on tab close)
    if (!sessionStorage.getItem(DISCLAIMER_KEY)) setShow(true);
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(DISCLAIMER_KEY, "1");
    setShow(false);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {show && (
        <div className="shrink-0 mx-4 mt-3 flex items-start gap-2.5 px-3 py-2.5 bg-[#161b22] border border-[#d29922]/30 rounded-lg">
          <AlertTriangle size={12} className="text-[#d29922] mt-0.5 shrink-0" />
          <p className="flex-1 text-[10px] text-[#8b949e] leading-relaxed">
            <span className="text-[#d29922] font-semibold">Risk Disclaimer — </span>
            Trading Solana memecoins carries extreme risk including total loss of capital. Rug scores
            and signals are informational only — not financial advice. Trade only what you can afford
            to lose.{" "}
            <Link href="/settings#disclaimer" className="text-[#58a6ff] hover:underline">
              Full disclaimer →
            </Link>
          </p>
          <button
            onClick={dismiss}
            className="text-[#484f58] hover:text-[#8b949e] transition-colors shrink-0"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex-1 p-4 overflow-auto">
        <TokenList />
      </div>
    </div>
  );
}
