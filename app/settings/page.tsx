"use client";

import { useState, useEffect } from "react";
import { useWalletStore } from "@/store/walletStore";
import {
  Settings, Cpu, Zap, Shield, Bell, AlertTriangle, Check,
  ExternalLink, RotateCcw, ChevronRight,
} from "lucide-react";

// ─── Persisted settings keys ───────────────────────────────────────────────
const KEYS = {
  rpc:        "bf_rpc_endpoint",
  slippage:   "bf_slippage_bps",
  jito:       "bf_jito_enabled",
  jitoTip:    "bf_jito_tip_lamports",
  refreshRate:"bf_refresh_rate",
};

const DEFAULT_SLIPPAGE   = 100;   // 1 %
const DEFAULT_JITO_TIP   = 10000; // 0.00001 SOL
const DEFAULT_REFRESH    = 30;    // seconds
const MAINNET_RPC        = "https://api.mainnet-beta.solana.com";

// ─── Section card ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0d1117] border border-[#21262d] rounded-lg p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <Icon size={15} className="text-[#58a6ff]" />
        <h2 className="text-sm font-semibold text-[#e6edf3]">{title}</h2>
      </div>
      <p className="text-[11px] text-[#484f58] mb-4 ml-[23px]">{description}</p>
      <div className="ml-[23px] flex flex-col gap-4">{children}</div>
    </div>
  );
}

// ─── Toggle row ────────────────────────────────────────────────────────────
function Toggle({ label, sub, value, onChange }: {
  label: string; sub?: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-[#e6edf3]">{label}</p>
        {sub && <p className="text-[10px] text-[#484f58] mt-0.5">{sub}</p>}
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? "bg-[#58a6ff]" : "bg-[#30363d]"}`}
      >
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? "left-[18px]" : "left-0.5"}`} />
      </button>
    </div>
  );
}

// ─── Input row ─────────────────────────────────────────────────────────────
function InputRow({ label, sub, value, onChange, placeholder, type = "text", suffix }: {
  label: string; sub?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; suffix?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div>
        <p className="text-xs text-[#e6edf3]">{label}</p>
        {sub && <p className="text-[10px] text-[#484f58] mt-0.5">{sub}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-3 py-1.5 text-xs font-mono text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#58a6ff] transition-colors"
        />
        {suffix && <span className="text-[11px] text-[#484f58] shrink-0">{suffix}</span>}
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { isPaperTrading, togglePaperTrading } = useWalletStore();

  const [rpc,         setRpc]         = useState(MAINNET_RPC);
  const [slippage,    setSlippage]    = useState(String(DEFAULT_SLIPPAGE));
  const [jito,        setJito]        = useState(false);
  const [jitoTip,     setJitoTip]     = useState(String(DEFAULT_JITO_TIP));
  const [refreshRate, setRefreshRate] = useState(String(DEFAULT_REFRESH));
  const [saved,       setSaved]       = useState(false);

  // Load from localStorage
  useEffect(() => {
    setRpc(localStorage.getItem(KEYS.rpc)         || MAINNET_RPC);
    setSlippage(localStorage.getItem(KEYS.slippage)   || String(DEFAULT_SLIPPAGE));
    setJito(localStorage.getItem(KEYS.jito)        === "true");
    setJitoTip(localStorage.getItem(KEYS.jitoTip)    || String(DEFAULT_JITO_TIP));
    setRefreshRate(localStorage.getItem(KEYS.refreshRate) || String(DEFAULT_REFRESH));
  }, []);

  const handleSave = () => {
    localStorage.setItem(KEYS.rpc,         rpc);
    localStorage.setItem(KEYS.slippage,    slippage);
    localStorage.setItem(KEYS.jito,        String(jito));
    localStorage.setItem(KEYS.jitoTip,     jitoTip);
    localStorage.setItem(KEYS.refreshRate, refreshRate);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setRpc(MAINNET_RPC);
    setSlippage(String(DEFAULT_SLIPPAGE));
    setJito(false);
    setJitoTip(String(DEFAULT_JITO_TIP));
    setRefreshRate(String(DEFAULT_REFRESH));
  };

  const slippagePct = (Number(slippage) / 100).toFixed(1);
  const jitoSol     = (Number(jitoTip) / 1e9).toFixed(6);

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-9 h-9 rounded-lg bg-[#1e2530] border border-[#30363d] flex items-center justify-center">
          <Settings size={16} className="text-[#58a6ff]" />
        </div>
        <div>
          <h1 className="text-base font-bold text-[#e6edf3]">Settings</h1>
          <p className="text-[11px] text-[#484f58]">Configure your trading environment</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">

        {/* ── Trading ─────────────────────────────────────────────────────── */}
        <Section icon={Zap} title="Trading" description="Execution preferences and order defaults">
          <Toggle
            label="Paper Trading Mode"
            sub="Simulate trades with virtual SOL — no real funds at risk"
            value={isPaperTrading}
            onChange={togglePaperTrading}
          />
          <InputRow
            label="Default Slippage Tolerance"
            sub={`Current: ${slippagePct}% — applied to all market orders`}
            value={slippage}
            onChange={setSlippage}
            placeholder="100"
            type="number"
            suffix="bps"
          />
        </Section>

        {/* ── MEV Protection ──────────────────────────────────────────────── */}
        <Section icon={Shield} title="MEV Protection (Jito)" description="Route orders through Jito block-engine to prevent sandwich attacks">
          <Toggle
            label="Enable Jito Bundles"
            sub="Adds tip to prioritise your transaction in a Jito bundle"
            value={jito}
            onChange={setJito}
          />
          {jito && (
            <InputRow
              label="Jito Tip"
              sub={`≈ ${jitoSol} SOL per trade — higher tip = higher priority`}
              value={jitoTip}
              onChange={setJitoTip}
              placeholder="10000"
              type="number"
              suffix="lamports"
            />
          )}
        </Section>

        {/* ── Network ─────────────────────────────────────────────────────── */}
        <Section icon={Cpu} title="Network" description="Solana RPC endpoint used for transaction submission and balance queries">
          <InputRow
            label="RPC Endpoint"
            sub="Use a private RPC for faster execution (Helius, QuickNode, Alchemy)"
            value={rpc}
            onChange={setRpc}
            placeholder={MAINNET_RPC}
          />
          <InputRow
            label="Discovery Refresh Interval"
            sub="How often the New Launches feed auto-refreshes"
            value={refreshRate}
            onChange={setRefreshRate}
            placeholder="30"
            type="number"
            suffix="seconds"
          />
        </Section>

        {/* ── Notifications ───────────────────────────────────────────────── */}
        <Section icon={Bell} title="Notifications" description="Browser alerts for key on-chain events">
          <div className="text-[11px] text-[#484f58] px-3 py-2 bg-[#161b22] rounded border border-[#21262d]">
            Browser notification support coming soon — LP drain alerts and smart money buys will trigger desktop notifications when enabled.
          </div>
        </Section>

        {/* ── Save / Reset ────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-[11px] text-[#484f58] hover:text-[#8b949e] transition-colors"
          >
            <RotateCcw size={11} />
            Reset to defaults
          </button>
          <button
            onClick={handleSave}
            className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-semibold transition-all ${
              saved
                ? "bg-[#1a3826] text-[#3fb950] border border-[#3fb950]/30"
                : "bg-[#58a6ff] text-[#080b12] hover:bg-[#79b8ff]"
            }`}
          >
            {saved ? <><Check size={12} />Saved</> : "Save Settings"}
          </button>
        </div>

        {/* ── Disclaimer ──────────────────────────────────────────────────── */}
        <div id="disclaimer" className="mt-4 bg-[#161b22] border border-[#d29922]/30 rounded-lg p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="text-[#d29922] mt-0.5 shrink-0" />
            <div>
              <p className="text-[11px] font-semibold text-[#d29922] mb-1.5">Risk Disclaimer</p>
              <p className="text-[10px] text-[#8b949e] leading-relaxed">
                BlockForecast is a market-data and analytics tool, not a financial advisor. Trading
                Solana memecoins involves substantial risk of loss — assets can lose all value
                instantly due to rug pulls, liquidity removal, or market conditions. Rug scores,
                signals, and on-chain analytics are informational only and do not constitute
                investment advice. Never trade with funds you cannot afford to lose. Always DYOR
                (Do Your Own Research) before executing any trade. Past performance of any token
                is not indicative of future results. BlockForecast accepts no liability for trading
                decisions made using this platform.
              </p>
              <div className="flex items-center gap-3 mt-2.5">
                <a
                  href="https://solscan.io"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-[#484f58] hover:text-[#58a6ff] transition-colors"
                >
                  Verify on-chain <ExternalLink size={8} />
                </a>
                <span className="text-[#21262d]">•</span>
                <span className="text-[10px] text-[#484f58]">Data sourced from Bitquery, DexScreener & GeckoTerminal</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── App info ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between text-[10px] text-[#484f58] pt-1 pb-4">
          <span>BlockForecast v3 · Solana Trading Terminal</span>
          <div className="flex items-center gap-3">
            <span>Powered by Bitquery</span>
            <span>·</span>
            <a
              href="/settings#disclaimer"
              className="hover:text-[#8b949e] transition-colors flex items-center gap-1"
            >
              Risk Disclaimer <ChevronRight size={9} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
