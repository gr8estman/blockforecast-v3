"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { WalletWidget } from "@/components/wallet/WalletControls";
import { LiveDot } from "@/components/ui";
import {
  Zap,
  BarChart2,
  Shield,
  Briefcase,
  Settings,
  TrendingUp,
  Crosshair,
  Globe,
  Scale,
} from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";

const NAV_LINKS = [
  { href: "/",                 label: "Discover",  icon: Zap       },
  { href: "/terminal",         label: "Terminal",  icon: BarChart2  },
  { href: "/sniper",           label: "Sniper",    icon: Crosshair  },
  { href: "/markets",          label: "Markets",   icon: Scale      },
  { href: "/portfolio",        label: "Portfolio", icon: Briefcase  },
  { href: "/sentinel",         label: "Sentinel",  icon: Shield     },
  { href: "/discovery/ton",    label: "TON",       icon: Globe      },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 h-12 bg-[#080b12] border-b border-[#21262d] flex items-center px-4 gap-4">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 shrink-0">
        <div className="w-6 h-6 bg-[#58a6ff] rounded flex items-center justify-center">
          <TrendingUp size={14} className="text-[#080b12]" strokeWidth={2.5} />
        </div>
        <span className="text-sm font-bold text-[#e6edf3] tracking-tight">
          Block<span className="text-[#58a6ff]">Forecast</span>
        </span>
      </Link>

      {/* Nav Links */}
      <nav className="flex items-center gap-1 ml-2">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all",
                active
                  ? "bg-[#1e2530] text-[#e6edf3]"
                  : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22]",
                // Red tint for Sniper when active
                href === "/sniper" && active
                  ? "text-[#f85149]"
                  : ""
              )}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Live indicator */}
      <div className="flex items-center gap-1.5 ml-2">
        <LiveDot color="green" />
        <span className="text-[10px] text-[#8b949e] font-mono">LIVE</span>
      </div>

      {/* Global Search */}
      <GlobalSearch />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Wallet Widget */}
      <WalletWidget />

      {/* Settings */}
      <Link
        href="/settings"
        className="p-1.5 rounded text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1e2530] transition-all"
      >
        <Settings size={15} />
      </Link>
    </header>
  );
}
