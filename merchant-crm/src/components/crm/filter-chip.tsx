"use client";

import { cn } from "@/lib/utils";

export function CrmFilterChip({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-all duration-200",
        active
          ? "bg-text-100 text-white shadow-[0_6px_20px_rgba(10,12,18,0.18)]"
          : "bg-surface text-text-400 ring-1 ring-border-subtle hover:text-text-100 hover:ring-electric-500/25",
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          "min-w-[1.35rem] rounded-full px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums leading-none",
          active ? "bg-white/20 text-white" : "bg-canvas text-text-400",
          count > 0 && !active && "text-electric-600",
        )}
      >
        {count}
      </span>
    </button>
  );
}
