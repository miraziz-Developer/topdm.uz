"use client";

import { cn } from "@/lib/utils";

type Props = {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  label?: string;
};

export function ProductStatusToggle({ checked, disabled, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? (checked ? "Faol" : "Nofaol")}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-emerald-500" : "bg-neutral-300",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <span
        className={cn(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
