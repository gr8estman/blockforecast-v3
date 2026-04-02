import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next.js 16 uses Turbopack by default — empty config is fine
  turbopack: {},

  // Skip TS check during build (server OOMs on tsc). Run `npx tsc --noEmit` separately.
  typescript: { ignoreBuildErrors: true },

  // Allow Solana CDN images
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.arweave.net" },
      { protocol: "https", hostname: "**.ipfs.io" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },

  // Don't bundle these packages — they use native bindings or WASM that
  // Turbopack can't handle (kafkajs-lz4 → lz4-asm → _lz4.wasm)
  serverExternalPackages: [
    "kafkajs",
    "lz4",           // native bindings — no WASM, must not be bundled
    "protobufjs",
    "bitquery-protobuf-schema",
  ],

  // Experimental features needed for server actions
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
};

export default nextConfig;
