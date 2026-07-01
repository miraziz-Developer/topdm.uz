import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, leftIcon, rightIcon, label, ...props }, ref) => {
    return (
      <div className="w-full space-y-1.5">
        {label ? <label className="text-sm font-medium leading-none text-foreground/90">{label}</label> : null}
        <div className="relative flex items-center">
          {leftIcon ? (
            <div className="pointer-events-none absolute left-3 flex items-center justify-center text-muted-foreground">
              {leftIcon}
            </div>
          ) : null}
          <input
            type={type}
            className={cn(
              "flex h-10 w-full rounded-xl border border-border/80 bg-card/80 px-3 py-1 text-sm shadow-sm backdrop-blur transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
              error && "border-destructive focus-visible:ring-destructive/20",
              leftIcon && "pl-9",
              rightIcon && "pr-9",
              className,
            )}
            ref={ref}
            {...props}
          />
          {rightIcon ? (
            <div className="pointer-events-none absolute right-3 flex items-center justify-center text-muted-foreground">
              {rightIcon}
            </div>
          ) : null}
        </div>
        {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
      </div>
    );
  },
);
Input.displayName = "Input";
