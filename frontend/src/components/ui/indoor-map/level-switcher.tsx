"use client";

import { cn } from "@/lib/utils";
import type { IndoorLevel } from "@/lib/indoor-map/types";

type LevelSwitcherProps = {
  levels: IndoorLevel[];
  value: number;
  onChange: (level: number) => void;
  className?: string;
};

export function LevelSwitcher({ levels, value, onChange, className }: LevelSwitcherProps) {
  return (
    <div className={cn("inline-flex rounded-full border border-border-subtle bg-white p-1 shadow-sm", className)} role="tablist" aria-label="Qavat tanlash">
      {levels.map((level) => {
        const active = level.level === value;
        return (
          <button
            key={level.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(level.level)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              active ? "bg-electric-500 text-white shadow-sm" : "text-ink-600 hover:bg-elevated",
            )}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
