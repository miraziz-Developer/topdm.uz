"use client";

import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type ProductRatingStarsProps = {
  rating: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
} as const;

/** 5 yulduz — to'ldirilgan qism rating bo'yicha (0.5+ yaxlitlash). */
export function ProductRatingStars({ rating, size = "md", className }: ProductRatingStarsProps) {
  const filled = Math.max(0, Math.min(5, Math.round(rating)));
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} aria-hidden>
      {Array.from({ length: 5 }).map((_, idx) => (
        <Star
          key={idx}
          className={cn(
            SIZE[size],
            idx < filled ? "fill-amber-400 text-amber-400" : "text-ink-200",
          )}
        />
      ))}
    </span>
  );
}

type InteractiveStarPickerProps = {
  value: number;
  onChange: (value: number) => void;
};

const STAR_HINTS = [
  "",
  "Juda yomon",
  "Yomon",
  "O'rtacha",
  "Yaxshi",
  "A'lo — tavsiya qilaman",
];

export function InteractiveStarPicker({ value, onChange }: InteractiveStarPickerProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Baho — 1 dan 5 gacha yulduz">
        {Array.from({ length: 5 }).map((_, idx) => {
          const star = idx + 1;
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              onClick={() => onChange(star)}
              className="rounded-md p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              <Star
                className={cn(
                  "h-8 w-8 sm:h-9 sm:w-9",
                  active ? "fill-amber-400 text-amber-400" : "text-ink-200",
                )}
              />
            </button>
          );
        })}
      </div>
      <p className="text-xs text-ink-500">
        {value > 0 ? (
          <>
            <span className="font-medium text-ink-700">{value}/5</span>
            {" — "}
            {STAR_HINTS[value]}
          </>
        ) : (
          "Baho tanlang: 1 yulduz — yomon, 5 yulduz — a'lo"
        )}
      </p>
    </div>
  );
}
