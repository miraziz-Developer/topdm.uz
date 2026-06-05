"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isChinaMarketEnabled } from "@/lib/runtime-flags";
import { cn } from "@/lib/utils";

type Tab = "china" | "local";

const ALL_TABS: { id: Tab; label: string; href: string }[] = [
  { id: "china", label: "Xitoy", href: "/market/china" },
  { id: "local", label: "Ichki bozor", href: "/market/local" },
];

export function MarketNavigation() {
  const pathname = usePathname();
  const tabs = isChinaMarketEnabled() ? ALL_TABS : ALL_TABS.filter((t) => t.id === "local");
  const active: Tab = pathname?.includes("/market/local") ? "local" : "china";

  return (
    <nav className="flex gap-2 sm:gap-3" aria-label="Market bo'limi">
      {tabs.map((tab) => {
        const on = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            className={cn(
              "flex-1 rounded-2xl border px-4 py-3 text-center text-sm font-semibold transition-all duration-200",
              on
                ? "border-electric-500/40 bg-electric-500 text-white shadow-sm"
                : "border-border-subtle bg-bg-input text-ink-600 hover:border-electric-500/30 hover:text-electric-500",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
