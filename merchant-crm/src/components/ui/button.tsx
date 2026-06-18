import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-xl text-sm font-semibold tracking-tight transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-electric-500/45 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:pointer-events-none active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-electric text-white shadow-[0_4px_18px_rgba(0,102,255,0.38)] hover:brightness-105 hover:shadow-[0_8px_28px_rgba(0,102,255,0.45)] relative overflow-hidden border-0",
        secondary:
          "bg-surface/90 text-text-100 border border-border-subtle backdrop-blur-sm hover:border-electric-500/30 hover:bg-electric-500/[0.04] active:bg-elevated",
        ghost: "bg-transparent text-text-300 hover:text-text-100 hover:bg-elevated/80 active:bg-elevated",
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
  ({ className, variant, size, isLoading, leftIcon, rightIcon, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        disabled={isLoading || disabled}
        {...props}
      >
        {variant === "primary" && !isLoading && !disabled && (
          <span className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_infinite] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
