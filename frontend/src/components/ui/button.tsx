import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-bold tracking-tight transition-all duration-250 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none active:scale-[0.97]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-electric text-white shadow-[0_4px_18px_rgba(0,102,255,0.38)] hover:scale-[1.02] hover:shadow-[0_8px_28px_rgba(0,102,255,0.45)] hover:brightness-105 relative overflow-hidden border-0",
        brand:
          "checkout-cta bg-gradient-electric text-white shadow-[0_4px_18px_rgba(0,102,255,0.38)] hover:brightness-105 hover:shadow-[0_8px_28px_rgba(0,102,255,0.45)] relative overflow-hidden border-0",
        accent:
          "sales-cta sales-cta-pulse bg-gradient-gold text-white shadow-gold hover:scale-[1.02] hover:shadow-hover hover:brightness-110 relative overflow-hidden border-0",
        sales:
          "sales-cta sales-cta-pulse text-white shadow-gold hover:scale-[1.02] hover:brightness-110 relative overflow-hidden border-0",
        secondary:
          "bg-white text-ink-900 border-2 border-border-default shadow-card hover:border-electric-500/40 hover:shadow-hover hover:bg-white active:bg-elevated",
        ghost: "bg-transparent text-ink-500 hover:text-ink-900 hover:bg-elevated active:bg-elevated",
        danger: "bg-red text-white hover:opacity-90 active:opacity-80 shadow-sm",
      },
      size: {
        sm: "h-10 min-h-10 px-3 text-xs sm:h-9",
        md: "h-11 min-h-11 px-5",
        lg: "h-14 min-h-14 px-8 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, type, ...props }, ref) => {
    return (
      <button
        type={type ?? "button"}
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {(variant === "primary" || variant === "brand" || variant === "accent" || variant === "sales") && !isLoading && !disabled && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent"
          />
        )}
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = "Button";
