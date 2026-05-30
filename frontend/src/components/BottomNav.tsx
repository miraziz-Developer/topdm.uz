"use client";

import { motion } from "framer-motion";
import { Film, Home, Map, Search, ShoppingBag, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useCartStore } from "@/stores/cart-store";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", icon: Home, label: "Bosh" },
  { href: "/reels", icon: Film, label: "Reels" },
  { href: "/search", icon: Search, label: "Qidirish" },
  { href: "/checkout", icon: ShoppingBag, label: "Savatcha" },
  { href: "/profile", icon: User, label: "Profil" },
];

export function BottomNav() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const cartItems = useCartStore((state) => state.totalItems());
  const totalItems = mounted ? cartItems : 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto grid w-full max-w-lg grid-cols-5 rounded-2xl glass-panel-strong shadow-elevated ring-1 ring-black/[0.04]">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href === "/map" && pathname.startsWith("/map"));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-cart-anchor={item.href === "/checkout" ? true : undefined}
              className={cn(
                "relative flex min-h-[52px] min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] font-medium transition-colors sm:min-h-[56px] sm:text-[11px]",
                isActive ? "font-bold text-electric-500" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <span className="relative">
                <item.icon className="h-5 w-5" />
                {item.href === "/checkout" && totalItems > 0 ? (
                  <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[9px] font-bold text-canvas">
                    {totalItems}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
              {isActive ? (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute -top-px left-1/4 right-1/4 h-0.5 rounded-full bg-electric-500"
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
