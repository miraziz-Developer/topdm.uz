"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Menu, MessageSquare, Store, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { href: "/dashboard", label: "Bosh", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/shops", label: "Do'kon", icon: Store },
  { href: "/dashboard/payouts", label: "To'lov", icon: Wallet },
  { href: "/dashboard/support", label: "Chat", icon: MessageSquare },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminMobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border/80 bg-background/95 backdrop-blur-xl lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="Mobil navigatsiya"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 pt-1">
        {MOBILE_TABS.map((tab) => {
          const active = isActive(pathname, tab.href, "exact" in tab ? tab.exact : false);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex min-h-[52px] min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold transition",
                active ? "text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-primary")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex min-h-[52px] min-w-[4rem] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-semibold text-muted-foreground"
        >
          <Menu className="h-5 w-5" />
          <span>Menyu</span>
        </button>
      </div>
    </nav>
  );
}
