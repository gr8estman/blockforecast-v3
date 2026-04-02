import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(address: string, chars = 4): string {
  if (!address) return "";
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function formatPrice(price: number): string {
  const p = Number(price);
  if (!p || isNaN(p)) return "$0.00";
  if (p < 0.000001) return `$${p.toExponential(4)}`;
  if (p < 0.001) return `$${p.toFixed(8)}`;
  if (p < 1) return `$${p.toFixed(6)}`;
  if (p < 1000) return `$${p.toFixed(4)}`;
  return `$${p.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function formatAmount(amount: number): string {
  const n = Number(amount);
  if (isNaN(n)) return "0.00";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  return n.toFixed(2);
}

export function formatUsd(amount: number): string {
  const n = Number(amount);
  if (isNaN(n)) return "$0.00";
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

export function formatPct(pct: number, decimals = 2): string {
  const n = Number(pct);
  if (isNaN(n)) return "+0.00%";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(decimals)}%`;
}

export function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function rugScoreColor(score: number): string {
  if (score >= 80) return "text-[#3fb950]";
  if (score >= 60) return "text-[#d29922]";
  if (score >= 40) return "text-[#e3b341]";
  return "text-[#f85149]";
}

export function rugScoreLabel(score: number): string {
  if (score >= 80) return "SAFE";
  if (score >= 60) return "LOW RISK";
  if (score >= 40) return "MEDIUM RISK";
  if (score >= 20) return "HIGH RISK";
  return "RUG";
}
