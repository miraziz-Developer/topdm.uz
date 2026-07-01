"use client";

import { Check } from "lucide-react";

import { CHECKOUT_STEPS, type CheckoutStepId } from "@/components/brand/premium-market-ui";
import { cn } from "@/lib/utils";

type Props = {
  activeStep: CheckoutStepId;
  className?: string;
};

export function CheckoutStepper({ activeStep, className }: Props) {
  const activeIndex = CHECKOUT_STEPS.findIndex((s) => s.id === activeStep);

  return (
    <nav aria-label="Checkout bosqichlari" className={cn("market-stepper", className)}>
      <ol className="flex items-center justify-between gap-2">
        {CHECKOUT_STEPS.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <li key={step.id} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none">
              <div className="flex min-w-0 flex-col items-center gap-1.5 sm:flex-row sm:gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition",
                    done && "bg-green text-white shadow-sm",
                    active && !done && "bg-electric-500 text-white shadow-[0_0_0_4px_rgba(0,102,255,0.18)]",
                    !done && !active && "border border-border-default bg-white text-text-400",
                  )}
                  aria-current={active ? "step" : undefined}
                >
                  {done ? <Check className="h-4 w-4" aria-hidden /> : step.short}
                </span>
                <span
                  className={cn(
                    "truncate text-[11px] font-semibold uppercase tracking-wide sm:text-xs",
                    active || done ? "text-ink-900" : "text-text-400",
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < CHECKOUT_STEPS.length - 1 ? (
                <div
                  className={cn(
                    "hidden h-px flex-1 sm:block",
                    index < activeIndex ? "bg-green/60" : "bg-border-default",
                  )}
                  aria-hidden
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
