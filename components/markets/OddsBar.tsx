"use client";

interface OddsBarProps {
  yesPool: number;
  noPool:  number;
  size?:   "sm" | "md";
}

export function OddsBar({ yesPool, noPool, size = "md" }: OddsBarProps) {
  const total   = yesPool + noPool;
  const yesPct  = total > 0 ? (yesPool / total) * 100 : 50;
  const noPct   = 100 - yesPct;
  const h       = size === "sm" ? "h-1.5" : "h-2.5";

  return (
    <div className="w-full">
      {/* Labels */}
      <div className="flex justify-between text-[10px] font-mono mb-1">
        <span className="text-[#3fb950]">YES {yesPct.toFixed(1)}%</span>
        <span className="text-[#f85149]">NO {noPct.toFixed(1)}%</span>
      </div>
      {/* Bar */}
      <div className={`flex w-full ${h} rounded-full overflow-hidden bg-[#161b22]`}>
        <div
          className="bg-[#3fb950] transition-all duration-500"
          style={{ width: `${yesPct}%` }}
        />
        <div
          className="bg-[#f85149] transition-all duration-500"
          style={{ width: `${noPct}%` }}
        />
      </div>
      {/* Volume */}
      {total > 0 && (
        <p className="text-[10px] text-[#8b949e] mt-1 text-right font-mono">
          {total.toFixed(3)} SOL pool
        </p>
      )}
    </div>
  );
}
