"use client";

import React from "react";
import { cn } from "@/lib/utils";

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "success" | "danger" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}

export function Button({
  variant = "default",
  size = "md",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer select-none";

  const variants = {
    default: "bg-[#1e2530] hover:bg-[#21262d] text-[#e6edf3] border border-[#30363d]",
    primary: "bg-[#58a6ff] hover:bg-[#4d93e8] text-[#080b12]",
    success: "bg-[#3fb950] hover:bg-[#2ea043] text-[#080b12]",
    danger: "bg-[#f85149] hover:bg-[#da3633] text-white",
    ghost: "hover:bg-[#1e2530] text-[#8b949e] hover:text-[#e6edf3]",
    outline: "border border-[#30363d] hover:border-[#58a6ff] text-[#e6edf3] hover:text-[#58a6ff]",
  };

  const sizes = {
    sm: "text-xs px-2.5 py-1.5 h-7",
    md: "text-sm px-3.5 py-2 h-9",
    lg: "text-base px-5 py-2.5 h-11",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-[#0d1117] border border-[#21262d] rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

interface BadgeProps {
  variant?: "green" | "red" | "yellow" | "blue" | "purple" | "gray";
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = "gray", children, className }: BadgeProps) {
  const variants = {
    green: "bg-[#1a3826] text-[#3fb950] border-[#2a5c3a]",
    red: "bg-[#3d1a1a] text-[#f85149] border-[#6b2929]",
    yellow: "bg-[#3d2f0a] text-[#d29922] border-[#5c4515]",
    blue: "bg-[#0d2340] text-[#58a6ff] border-[#1a3d6b]",
    purple: "bg-[#2d1f4a] text-[#bc8cff] border-[#4a3373]",
    gray: "bg-[#1e2530] text-[#8b949e] border-[#30363d]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <svg
      className={cn("animate-spin text-[#8b949e]", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── LiveDot ──────────────────────────────────────────────────────────────────

export function LiveDot({ color = "green" }: { color?: "green" | "red" | "yellow" }) {
  const colors = {
    green: "bg-[#3fb950]",
    red: "bg-[#f85149]",
    yellow: "bg-[#d29922]",
  };
  return (
    <span className={cn("inline-block w-2 h-2 rounded-full live-dot", colors[color])} />
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ className }: { className?: string }) {
  return <div className={cn("border-t border-[#21262d]", className)} />;
}

// ─── NumberInput ─────────────────────────────────────────────────────────────

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  prefix?: string;
  suffix?: string;
}

export function NumberInput({ prefix, suffix, className, ...props }: NumberInputProps) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 text-[#8b949e] text-sm select-none">{prefix}</span>
      )}
      <input
        type="number"
        className={cn(
          "w-full bg-[#161b22] border border-[#30363d] rounded px-3 py-2 text-sm text-[#e6edf3]",
          "focus:outline-none focus:border-[#58a6ff] placeholder-[#484f58]",
          "[-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
          prefix && "pl-7",
          suffix && "pr-10",
          className
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute right-3 text-[#8b949e] text-sm select-none">{suffix}</span>
      )}
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({
  title,
  action,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between px-3 py-2 border-b border-[#21262d]", className)}>
      <span className="text-xs font-semibold text-[#8b949e] uppercase tracking-wider">
        {title}
      </span>
      {action}
    </div>
  );
}
