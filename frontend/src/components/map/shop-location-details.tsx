"use client";

import { MapPin, MessageSquare } from "lucide-react";

import type { ShopLocationDetails } from "@/lib/map/shop-location-display";
import { cn } from "@/lib/utils";

type ShopLocationDetailsProps = {
  location: ShopLocationDetails;
  compact?: boolean;
  className?: string;
};

function LocationChip({
  label,
  value,
  emphasize = false,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-2 py-1.5 text-center",
        emphasize
          ? "border-[#1E98FF] bg-[#1E98FF]/10 shadow-sm"
          : "border-slate-200/90 bg-white/95",
      )}
    >
      <p className="text-[9px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p
        className={cn(
          "mt-0.5 text-xs font-extrabold leading-tight",
          emphasize ? "text-[#0066ff]" : "text-slate-900",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function buildChips(location: ShopLocationDetails): { label: string; value: string; emphasize?: boolean }[] {
  const chips: { label: string; value: string; emphasize?: boolean }[] = [];

  if (location.building) {
    chips.push({ label: "Bino", value: location.building });
  } else if (location.block) {
    chips.push({ label: "Blok", value: `${location.block}-blok` });
  }

  if (location.row) {
    chips.push({ label: "Qator", value: location.row });
  }

  if (location.floor) {
    chips.push({ label: "Qavat", value: location.floor });
  }

  chips.push({ label: "Do'kon №", value: location.stallNumber, emphasize: true });

  return chips;
}

export function ShopLocationDetailsCard({
  location,
  compact = false,
  className,
}: ShopLocationDetailsProps) {
  const chips = buildChips(location);

  return (
    <div
      className={cn(
        "rounded-xl border-2 border-amber-400/70 bg-gradient-to-br from-amber-50 to-orange-50/80 shadow-sm",
        compact ? "p-2" : "p-3",
        className,
      )}
    >
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        {location.market}
      </p>

      <div
        className={cn(
          "grid gap-1.5",
          compact ? "grid-cols-2" : chips.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2",
        )}
      >
        {chips.map((chip) => (
          <LocationChip key={chip.label} label={chip.label} value={chip.value} emphasize={chip.emphasize} />
        ))}
      </div>

      {location.comment ? (
        <p
          className={cn(
            "mt-2 flex items-start gap-2 rounded-lg border border-amber-300/80 bg-white/90 px-2.5 py-2 text-xs font-semibold leading-snug text-amber-950 shadow-inner",
            compact && "text-[11px]",
          )}
        >
          <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
          <span>{location.comment}</span>
        </p>
      ) : null}
    </div>
  );
}
