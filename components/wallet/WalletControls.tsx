"use client";

import React, { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWalletStore } from "@/store/walletStore";
import {
  generateWallet,
  loadWalletFromStorage,
  saveWalletToStorage,
  getSOLBalance,
} from "@/lib/wallet/generated";
import { cn, shortAddress, formatAmount } from "@/lib/utils";
import { Button, Badge } from "@/components/ui";
import {
  Wallet,
  Zap,
  Copy,
  RefreshCw,
  FlaskConical,
  ChevronDown,
} from "lucide-react";

// ─── Wallet Mode Toggle ───────────────────────────────────────────────────────

export function WalletModeToggle() {
  const { mode, setMode, isPaperTrading, togglePaperTrading } = useWalletStore();

  return (
    <div className="flex items-center gap-2">
      {/* Paper Trading Toggle */}
      <button
        onClick={togglePaperTrading}
        className={cn(
          "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium border transition-all",
          isPaperTrading
            ? "bg-[#3d2f0a] border-[#d29922] text-[#d29922]"
            : "bg-[#1e2530] border-[#30363d] text-[#8b949e] hover:border-[#484f58]"
        )}
      >
        <FlaskConical size={12} />
        {isPaperTrading ? "Paper ON" : "Paper"}
      </button>

      {/* Real / Generated Toggle */}
      <div className="flex items-center bg-[#161b22] border border-[#30363d] rounded overflow-hidden">
        <button
          onClick={() => setMode("phantom")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all",
            mode === "phantom"
              ? "bg-[#1e2530] text-[#58a6ff]"
              : "text-[#8b949e] hover:text-[#e6edf3]"
          )}
        >
          <Wallet size={11} />
          Phantom
        </button>
        <div className="w-px h-4 bg-[#30363d]" />
        <button
          onClick={() => setMode("generated")}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-all",
            mode === "generated"
              ? "bg-[#1e2530] text-[#3fb950]"
              : "text-[#8b949e] hover:text-[#e6edf3]"
          )}
        >
          <Zap size={11} />
          Bot Wallet
        </button>
      </div>
    </div>
  );
}

// ─── Phantom Wallet Button ────────────────────────────────────────────────────

export function PhantomConnectButton() {
  const { publicKey, connecting, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { setPhantomConnected } = useWalletStore();

  useEffect(() => {
    setPhantomConnected(connected, publicKey?.toBase58() ?? null);
  }, [connected, publicKey, setPhantomConnected]);

  if (connected && publicKey) {
    return (
      <button
        onClick={disconnect}
        className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#1e2530] border border-[#30363d] hover:border-[#f85149] text-xs text-[#e6edf3] transition-all group"
      >
        <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
        {shortAddress(publicKey.toBase58())}
        <ChevronDown size={11} className="text-[#8b949e] group-hover:text-[#f85149]" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setVisible(true)}
      disabled={connecting}
      className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#9945FF] hover:bg-[#8a3de8] text-white text-xs font-medium transition-all disabled:opacity-60"
    >
      <Wallet size={12} />
      {connecting ? "Connecting…" : "Connect Phantom"}
    </button>
  );
}

// ─── Generated Wallet Panel ───────────────────────────────────────────────────

export function GeneratedWalletPanel() {
  const { generated, setGeneratedWallet, setSolBalance } = useWalletStore();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  useEffect(() => {
    const saved = loadWalletFromStorage();
    if (saved) {
      setGeneratedWallet(saved);
      refreshBalance(saved.publicKey);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshBalance = async (pk: string) => {
    const bal = await getSOLBalance(pk);
    setSolBalance(bal);
  };

  const handleGenerate = () => {
    const wallet = generateWallet();
    saveWalletToStorage(wallet);
    setGeneratedWallet(wallet);
    setSolBalance(0);
    setShowExport(false);
  };

  const handleRefresh = async () => {
    if (!generated) return;
    setLoading(true);
    await refreshBalance(generated.publicKey);
    setLoading(false);
  };

  const handleCopy = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyKey = () => {
    if (!generated) return;
    navigator.clipboard.writeText(generated.secretKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  };

  if (!generated) {
    return (
      <Button variant="success" size="sm" onClick={handleGenerate}>
        <Zap size={12} />
        Generate Wallet
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#1e2530] border border-[#30363d] text-xs">
          <span className="w-2 h-2 rounded-full bg-[#3fb950]" />
          <span className="text-[#e6edf3] font-mono">{shortAddress(generated.publicKey)}</span>
          <button onClick={handleCopy} className="text-[#8b949e] hover:text-[#e6edf3] ml-1" title="Copy public key">
            <Copy size={10} />
          </button>
          {copied && <span className="text-[#3fb950] text-[10px]">Copied!</span>}
        </div>
        <button
          onClick={handleRefresh}
          className="p-1.5 rounded bg-[#1e2530] border border-[#30363d] hover:border-[#484f58] text-[#8b949e] hover:text-[#e6edf3] transition-all"
          title="Refresh SOL balance"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={() => setShowExport((v) => !v)}
          className={cn(
            "px-2 py-1.5 rounded border text-[10px] font-medium transition-all",
            showExport
              ? "bg-[#3d2f0a] border-[#d29922] text-[#d29922]"
              : "bg-[#1e2530] border-[#30363d] text-[#8b949e] hover:border-[#484f58]"
          )}
          title="Export private key"
        >
          Export
        </button>
      </div>

      {/* Private key export panel */}
      {showExport && (
        <div className="rounded border border-[#d29922]/40 bg-[#3d2f0a]/60 px-3 py-2 text-[10px] space-y-1.5">
          <p className="text-[#d29922] font-semibold">⚠ Private Key — never share this</p>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[#8b949e] truncate flex-1 select-all" title={generated.secretKey}>
              {generated.secretKey.slice(0, 20)}…{generated.secretKey.slice(-6)}
            </span>
            <button
              onClick={handleCopyKey}
              className="shrink-0 flex items-center gap-1 px-2 py-1 rounded bg-[#1e2530] border border-[#30363d] hover:border-[#d29922] text-[#8b949e] hover:text-[#d29922] transition-all"
            >
              <Copy size={9} />
              {keyCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="text-[#484f58]">Import into Phantom → Add / Connect Wallet → Import Private Key</p>
        </div>
      )}
    </div>
  );
}

// ─── Combined Wallet Header Widget ────────────────────────────────────────────

export function WalletWidget() {
  const { mode, solBalance } = useWalletStore();

  return (
    <div className="flex items-center gap-3">
      <WalletModeToggle />
      {mode === "phantom" ? <PhantomConnectButton /> : <GeneratedWalletPanel />}
      {solBalance > 0 && (
        <Badge variant="blue">{formatAmount(solBalance)} SOL</Badge>
      )}
    </div>
  );
}
