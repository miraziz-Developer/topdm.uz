"use client";

import { AnimatePresence, motion } from "framer-motion";
import { LayoutGrid, Search, User, Home, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/", icon: Home, label: "Bosh" },
  { href: "/search", icon: Search, label: "Qidirish" },
  { href: "/dashboard/shop", icon: LayoutGrid, label: "Panel" },
  { href: "/auth", icon: User, label: "Profil" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border-subtle bg-canvas/80 backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4">
        {items.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                isActive ? "text-gold-500" : "text-text-400 hover:text-text-200"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="bottomnav-indicator"
                  className="absolute -top-px left-1/4 right-1/4 h-0.5 rounded-full bg-gold-500"
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
