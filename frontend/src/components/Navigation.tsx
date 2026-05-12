"use client";

import { Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Bosh sahifa" },
  { href: "/search", label: "Qidiruv" },
  { href: "/dashboard/shop", label: "Dashboard" },
  { href: "/auth", label: "Kirish" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="sticky top-0 z-40 border-b border-border-subtle bg-canvas/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-gold">
            <Sparkles className="h-4 w-4 text-canvas" />
          </div>
          <span className="text-lg font-bold text-text-100">BOZOR <span className="text-gold-500">AI</span></span>
        </Link>
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-medium transition-all",
                pathname === link.href
                  ? "bg-surface text-text-100"
                  : "text-text-400 hover:bg-surface/50 hover:text-text-200"
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
