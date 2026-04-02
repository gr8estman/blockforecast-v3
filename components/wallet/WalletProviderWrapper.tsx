"use client";

import dynamic from "next/dynamic";
import React from "react";

// Load the entire Solana wallet adapter stack client-side only.
// This prevents Turbopack from bundling @solana/* globals (Buffer, crypto, etc.)
// into the server chunk, which causes ChunkLoadError at runtime.
const WalletProvider = dynamic(
  () => import("./WalletProvider").then((m) => m.WalletProvider),
  { ssr: false }
);

export function WalletProviderWrapper({ children }: { children: React.ReactNode }) {
  return <WalletProvider>{children}</WalletProvider>;
}
