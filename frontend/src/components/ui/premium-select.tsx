"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type PremiumSelectOption<T extends string> = {
  value: T;
  label: string;
};

type PremiumSelectProps<T extends string> = {
  value: T;
  options: PremiumSelectOption<T>[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
};

export function PremiumSelect<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: PremiumSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active = options.find((o) => o.value === value);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.14em] text-gray-600">
        {label}
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full min-w-[7.5rem] items-center justify-between gap-2 rounded-xl border border-border-subtle",
          "bg-white/90 px-3 py-2 text-xs font-semibold text-ink-800 shadow-sm backdrop-blur-md",
          "transition hover:border-electric-500/30 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-electric-500/25",
          open && "border-electric-500/40 ring-2 ring-electric-500/20",
        )}
      >
        <span className="truncate">{active?.label ?? value}</span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-ink-500 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <ul
          role="listbox"
          className="absolute left-0 z-50 mt-1 min-w-full max-h-48 w-max min-w-[8.5rem] overflow-auto rounded-xl border border-border-subtle bg-white py-1 shadow-elevated"
        >
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full px-3 py-2 text-left text-xs font-medium transition",
                    selected
                      ? "bg-electric-500/10 text-electric-500"
                      : "text-ink-700 hover:bg-elevated/80",
                  )}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
