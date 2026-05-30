"use client";

import { Banknote, Check, CreditCard, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

import { getCheckoutPaymentOptions, type CheckoutPaymentOptions } from "@/lib/api";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { cn } from "@/lib/utils";

export type InStorePaymentMethod = "cash" | "terminal";
export type OnlinePaymentMethod = "click" | "payme";
export type CheckoutPaymentMethod = InStorePaymentMethod | OnlinePaymentMethod;

const IN_STORE_OPTIONS: Array<{
  id: InStorePaymentMethod;
  icon: typeof Banknote;
  title: string;
  subtitle: string;
}> = [
  {
    id: "cash",
    icon: Banknote,
    title: "Naqd pul",
    subtitle: "Mahsulotni tekshirib, naqd to'laysiz",
  },
  {
    id: "terminal",
    icon: CreditCard,
    title: "Terminal",
    subtitle: "Uzcard / Humo — do'konda kartadan",
  },
];

const ONLINE_OPTIONS: Array<{
  id: OnlinePaymentMethod;
  title: string;
  subtitle: string;
}> = [
  {
    id: "click",
    title: "Click",
    subtitle: "Bron qiling — Click orqali onlayn to'lov",
  },
  {
    id: "payme",
    title: "Payme",
    subtitle: "Bron qiling — Payme orqali onlayn to'lov",
  },
];

type PaymentMethodPickerProps = {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
};

export function PaymentMethodPicker({ value, onChange }: PaymentMethodPickerProps) {
  const onlineEnabled = allowOnlineCheckout();
  const [options, setOptions] = useState<CheckoutPaymentOptions | null>(null);

  useEffect(() => {
    if (!onlineEnabled) return;
    void getCheckoutPaymentOptions()
      .then(setOptions)
      .catch(() =>
        setOptions({
          in_store: ["cash", "terminal"],
          online: { click: false, payme: false, bridge: true },
        }),
      );
  }, [onlineEnabled]);

  const showOnline = onlineEnabled && (options?.online.bridge ?? false);
  const onlineIds = showOnline ? ONLINE_OPTIONS : [];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink-900">To&apos;lov usuli</h3>
        <p className="mt-0.5 text-[11px] text-ink-500">
          {showOnline ? "Do'konda yoki onlayn (bron + to'lov)" : "Faqat do'konda — yetkazish yo'q"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {IN_STORE_OPTIONS.map((option) => {
          const Icon = option.icon;
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.98]",
                selected
                  ? "border-electric-500 bg-white ring-2 ring-electric-500 shadow-sm"
                  : "border-border-default bg-white hover:border-electric-500/35 hover:bg-electric-500/[0.04]",
              )}
            >
              <OptionCheck selected={selected} />
              <Icon className={cn("mb-2.5 h-5 w-5", selected ? "text-electric-500" : "text-ink-500")} />
              <p className={cn("pr-8 text-sm font-bold", selected ? "text-electric-500" : "text-ink-900")}>
                {option.title}
              </p>
              <p className={cn("mt-1 text-[11px] leading-relaxed", selected ? "text-ink-600" : "text-ink-500")}>
                {option.subtitle}
              </p>
            </button>
          );
        })}
      </div>

      {onlineIds.length ? (
        <div className="space-y-2 border-t border-border-subtle pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-500">Onlayn</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {onlineIds.map((option) => {
              const selected = value === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onChange(option.id)}
                  className={cn(
                    "relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all duration-200 active:scale-[0.98]",
                    selected
                      ? "border-indigo-500 bg-white ring-2 ring-indigo-500/80 shadow-sm"
                      : "border-border-default bg-white hover:border-indigo-400/40",
                  )}
                >
                  <OptionCheck selected={selected} />
                  <Smartphone className={cn("mb-2.5 h-5 w-5", selected ? "text-indigo-600" : "text-ink-500")} />
                  <p className={cn("pr-8 text-sm font-bold", selected ? "text-indigo-600" : "text-ink-900")}>
                    {option.title}
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-500">{option.subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function OptionCheck({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full transition-all duration-200",
        selected ? "scale-100 bg-electric-500 text-white opacity-100" : "scale-75 opacity-0",
      )}
      aria-hidden={!selected}
    >
      <Check size={13} strokeWidth={3} />
    </span>
  );
}
