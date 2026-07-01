import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
  {
    variants: {
      variant: {
        primary:
          "text-primary-foreground shadow-glow [background:linear-gradient(135deg,hsl(248_72%_54%)_0%,hsl(258_68%_48%)_50%,hsl(173_58%_42%)_100%)] hover:brightness-105",
        default:
          "text-primary-foreground shadow-glow [background:linear-gradient(135deg,hsl(248_72%_54%)_0%,hsl(258_68%_48%)_50%,hsl(173_58%_42%)_100%)] hover:brightness-105",
        secondary:
          "border border-border/80 bg-card/90 text-foreground shadow-sm backdrop-blur hover:border-primary/20 hover:bg-accent/60",
        outline:
          "border border-border/80 bg-card/70 text-foreground shadow-sm backdrop-blur hover:border-primary/25 hover:bg-accent/40",
        ghost: "text-foreground hover:bg-accent/60 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        danger:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 rounded-lg px-3 text-xs",
        md: "h-10 px-4 py-2",
        lg: "h-11 rounded-xl px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
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
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  },
);
Button.displayName = "Button";
