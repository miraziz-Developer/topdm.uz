"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Checkout — Topdim electric blue accent scope */
export function CheckoutShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn("checkout-bozor", className)}
      data-brand="topdim-uz"
    >
      {children}
    </div>
  );
}
