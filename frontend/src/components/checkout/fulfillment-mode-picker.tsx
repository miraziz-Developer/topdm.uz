"use client";

import { MapPin, Truck } from "lucide-react";

import { cn } from "@/lib/utils";

export type FulfillmentMode = "pickup" | "delivery";

type FulfillmentModePickerProps = {
  value: FulfillmentMode;
  onChange: (mode: FulfillmentMode) => void;
};

export function FulfillmentModePicker({ value, onChange }: FulfillmentModePickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Yetkazish usuli">
      <button
        type="button"
        role="radio"
        aria-checked={value === "pickup"}
        onClick={() => onChange("pickup")}
        className={cn(
          "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/40",
          value === "pickup"
            ? "border-electric-500 bg-electric-500/10 shadow-[0_0_0_3px_rgba(10,124,255,0.12)]"
            : "border-border-default bg-white hover:border-electric-500/40",
        )}
      >
        <div className="flex items-center gap-2">
          <MapPin className={cn("h-5 w-5", value === "pickup" ? "text-electric-500" : "text-ink-500")} />
          <p className="text-sm font-bold text-ink-900">Do&apos;kondan olib ketish</p>
        </div>
        <p className="mt-1 text-xs text-ink-500">Do&apos;kon manzili va vaqtni tanlaysiz</p>
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={value === "delivery"}
        onClick={() => onChange("delivery")}
        className={cn(
          "rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/40",
          value === "delivery"
            ? "border-orange-400 bg-orange-50 shadow-[0_0_0_3px_rgba(251,146,60,0.2)]"
            : "border-border-default bg-white hover:border-orange-300",
        )}
      >
        <div className="flex items-center gap-2">
          <Truck className={cn("h-5 w-5", value === "delivery" ? "text-orange-600" : "text-ink-500")} />
          <p className="text-sm font-bold text-ink-900">Yetkazib berish</p>
        </div>
        <p className="mt-1 text-xs text-ink-500">Manzil + xarita orqali aniq joy</p>
      </button>
    </div>
  );
}
