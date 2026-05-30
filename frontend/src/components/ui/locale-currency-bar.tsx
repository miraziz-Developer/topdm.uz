"use client";

import { useEffect, useRef, useState } from "react";

import { useCurrency } from "@/components/providers/currency-provider";
import { useLocale } from "@/i18n/locale-provider";
import type { Locale } from "@/i18n/messages";
import type { CurrencyCode } from "@/lib/currency";
import { cn } from "@/lib/utils";

const NAV_LOCALES: { code: Locale; label: string }[] = [
  { code: "uz", label: "UZ" },
  { code: "ru", label: "RU" },
  { code: "en", label: "EN" },
];

const NAV_CURRENCIES: CurrencyCode[] = ["UZS", "USD"];

const triggerClass =
  "cursor-pointer text-xs font-semibold uppercase tracking-widest text-neutral-500 transition-colors hover:text-black";

type LocaleCurrencyNavProps = {
  className?: string;
};

function PopoverOption({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-black",
        active && "bg-neutral-100 font-semibold text-neutral-900",
      )}
    >
      {label}
    </button>
  );
}

/** Unified locale + currency trigger for the global navbar (`UZ | UZS`). */
export function LocaleCurrencyNav({ className }: LocaleCurrencyNavProps) {
  const { locale, setLocale } = useLocale();
  const { currency, setCurrency } = useCurrency();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  const localeLabel = NAV_LOCALES.find((item) => item.code === locale)?.label ?? "UZ";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Language ${localeLabel}, currency ${currency}`}
        onClick={() => setOpen((value) => !value)}
      >
        {localeLabel} | {currency}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-48 animate-fade-in rounded-xl border border-neutral-200/80 bg-white/80 p-4 shadow-[0_10px_30px_rgba(0,0,0,0.08)] backdrop-blur-xl"
        >
          <span
            className="pointer-events-none absolute -top-1.5 right-5 h-3 w-3 rotate-45 border border-neutral-200/80 border-b-0 border-r-0 bg-white/90"
            aria-hidden
          />

          <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Til
          </span>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {NAV_LOCALES.map((item) => (
              <PopoverOption
                key={item.code}
                active={locale === item.code}
                label={item.label}
                onClick={() => setLocale(item.code)}
              />
            ))}
          </div>

          <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-neutral-400">
            Valyuta
          </span>
          <div className="flex flex-wrap gap-1.5">
            {NAV_CURRENCIES.map((code) => (
              <PopoverOption
                key={code}
                active={currency === code}
                label={code}
                onClick={() => {
                  setCurrency(code);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated Use LocaleCurrencyNav in the navbar. */
export const LocaleCurrencyBar = LocaleCurrencyNav;
