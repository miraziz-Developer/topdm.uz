"use client";

import { MapPin, ShieldCheck, Truck } from "lucide-react";

const ITEMS = [
  { icon: Truck, label: "Bozordan olib ketish — bepul" },
  { icon: ShieldCheck, label: "Bron kafolati" },
  { icon: MapPin, label: "Ippodrom va Abu Sahiy xarita" },
] as const;

export function HomeTrustStrip() {
  return (
    <div className="border-b border-border-subtle/80 bg-white/90">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 py-2.5 text-[11px] font-semibold text-ink-600 sm:px-6 sm:text-xs">
        {ITEMS.map(({ icon: Icon, label }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 shrink-0 text-electric-500" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
