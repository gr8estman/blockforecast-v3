import { PortfolioView } from "@/components/portfolio/PortfolioView";

export default function PortfolioPage() {
  return (
    <div className="h-full overflow-y-auto max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <h1 className="text-lg font-bold text-[#e6edf3]">Portfolio</h1>
        <span className="text-xs text-[#484f58]">
          — pump.fun token holdings & P&L
        </span>
      </div>
      <PortfolioView />
    </div>
  );
}
