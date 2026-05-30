"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

type OtpInputProps = {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
};

export function OtpInput({
  value,
  onChange,
  length = 4,
  disabled = false,
  autoFocus = true,
  className,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  useEffect(() => {
    if (autoFocus && !disabled) {
      refs.current[0]?.focus();
    }
  }, [autoFocus, disabled]);

  const commit = (next: string[]) => {
    onChange(next.join("").slice(0, length));
  };

  const focusIndex = (index: number) => {
    refs.current[Math.max(0, Math.min(index, length - 1))]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
        commit(next);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next);
        focusIndex(index - 1);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      focusIndex(index - 1);
      return;
    }
    if (event.key === "ArrowRight") {
      focusIndex(index + 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    onChange(pasted);
    focusIndex(Math.min(pasted.length, length - 1));
  };

  return (
    <motion.div
      className={cn("flex justify-center gap-3", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={digit}
          disabled={disabled}
          aria-label={`Kod ${index + 1}`}
          onPaste={handlePaste}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onChange={(event) => {
            const char = event.target.value.replace(/\D/g, "").slice(-1);
            const next = [...digits];
            next[index] = char;
            commit(next);
            if (char && index < length - 1) focusIndex(index + 1);
          }}
          className={cn(
            "h-14 w-12 rounded-2xl border-2 bg-white text-center text-xl font-bold text-ink-900 outline-none transition",
            "border-border-default focus:border-electric-500 focus:ring-2 focus:ring-electric-500/25",
            disabled && "opacity-60",
          )}
        />
      ))}
    </motion.div>
  );
}
