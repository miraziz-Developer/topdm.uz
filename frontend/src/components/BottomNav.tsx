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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <div className="pointer-events-auto mx-auto grid w-full max-w-lg grid-cols-5 premium-dock">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href === "/map" && pathname.startsWith("/map"));
          return (
            <Link
              key={item.href}
              href={item.href}
              data-cart-anchor={item.href === "/checkout" ? true : undefined}
              className={cn(
                "relative flex min-h-[54px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-semibold transition-all duration-300 sm:min-h-[58px] sm:text-[11px]",
                isActive ? "premium-nav-active font-bold text-electric-500" : "text-ink-500 hover:text-ink-900",
              )}
            >
              <span className={cn("relative transition-transform duration-300", isActive && "scale-110")}>
                <item.icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                {item.href === "/checkout" && totalItems > 0 ? (
                  <span className="absolute -right-2.5 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-gradient-gold px-1 text-[9px] font-bold text-white shadow-gold ring-2 ring-white">
                    {totalItems}
                  </span>
                ) : null}
              </span>
              <span>{item.label}</span>
              {isActive ? (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute bottom-1 left-1/2 h-1 w-5 -translate-x-1/2 rounded-full bg-gradient-electric shadow-[0_0_8px_rgba(0,102,255,0.5)]"
                  transition={{ type: "spring", damping: 28, stiffness: 380 }}
                />
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
