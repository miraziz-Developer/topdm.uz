import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-bold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-electric-500/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-60 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "relative overflow-hidden border-0 bg-electric-500 text-white shadow-[0_10px_24px_-12px_rgba(0,102,255,0.75)] hover:-translate-y-0.5 hover:bg-blue-700",
        brand:
          "checkout-cta relative overflow-hidden border-0 bg-electric-500 text-white shadow-[0_10px_24px_-12px_rgba(0,102,255,0.75)] hover:-translate-y-0.5 hover:bg-blue-700",
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
        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon && <span className="mr-2">{leftIcon}</span>}
        {children}
        {!isLoading && rightIcon && <span className="ml-2">{rightIcon}</span>}
      </button>
    );
  }
);
Button.displayName = "Button";
