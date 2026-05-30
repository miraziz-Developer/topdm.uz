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
        {label && (
          <label className="text-[14px] font-medium text-text-300">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3 flex items-center justify-center text-text-400">
              {leftIcon}
            </div>
          )}
          <input
            type={type}
            className={cn(
              "flex h-12 w-full rounded-xl border bg-input px-3 py-2 text-sm text-text-100 transition-all duration-250 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-text-400 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-red focus-visible:border-red focus-visible:shadow-[0_0_0_1px_rgba(239,68,68,0.2)]"
                : "border-subtle focus-visible:border-gold-500 focus-visible:shadow-[0_0_0_1px_rgba(245,200,66,0.3)]",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 flex items-center justify-center text-text-400">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-sm font-medium text-red">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";
