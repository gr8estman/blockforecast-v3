import type { Metadata } from "next";
import "./globals.css";
import { WalletProviderWrapper } from "@/components/wallet/WalletProviderWrapper";
import { Navbar } from "@/components/layout/Navbar";
import { StatusBar } from "@/components/layout/StatusBar";

export const metadata: Metadata = {
  title: "BlockForecast — Solana Trading Terminal",
  description:
    "Real-time Solana memecoin trading terminal with rug detection, live charts, order book, and paper trading powered by Bitquery.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col h-screen overflow-hidden bg-[#080b12]">
        <WalletProviderWrapper>
          <Navbar />
          <main className="flex-1 min-h-0 w-full overflow-hidden">
            {children}
          </main>
          <StatusBar />
        </WalletProviderWrapper>
      </body>
    </html>
  );
}
