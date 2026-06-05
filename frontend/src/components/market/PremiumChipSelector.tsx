"use client";

import { cn } from "@/lib/utils";

type Props = {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
};

export function PremiumChipSelector({ label, options, value, onChange }: Props) {
  if (!options.length) return null;
  return (
    <div>
      <p className="mb-2.5 text-xs font-bold uppercase tracking-widest text-text-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const on = value === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200",
                on
                  ? "border-electric-500 bg-electric-500/10 text-electric-600 shadow-sm"
                  : "border-border-subtle bg-bg-input text-ink-700 hover:border-electric-500/30",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
