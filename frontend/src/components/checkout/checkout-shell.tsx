"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Checkout — premium Bozorliii scope */
export function CheckoutShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "checkout-bozor relative min-h-dvh overflow-hidden bg-canvas",
        "before:pointer-events-none before:absolute before:inset-0 before:premium-aurora before:opacity-90",
        "after:pointer-events-none after:absolute after:inset-x-[10%] after:top-0 after:h-px after:bg-gradient-to-r after:from-transparent after:via-electric-500/30 after:to-transparent",
        className,
      )}
      data-brand="bozorliii-uz"
    >
      <div className="relative mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>
    </div>
  );
}
