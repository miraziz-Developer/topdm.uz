"use client";

import { motion } from "framer-motion";
import { Camera, Loader2, Mic, Search } from "lucide-react";
import { forwardRef, useId, useRef, type InputHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

export type SearchFieldVariant = "pill" | "rounded" | "hero";

type SearchFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "onSubmit"> & {
  variant?: SearchFieldVariant;
  busy?: boolean;
  listening?: boolean;
  showPhotoButton?: boolean;
  showVoiceButton?: boolean;
  showSubmitButton?: boolean;
  submitLabel?: string;
  onSubmit?: () => void;
  onPhotoFile?: (file: File) => void;
  onVoice?: () => void;
  rightSlot?: ReactNode;
};

/**
 * Unified search input used in the header, hero, and search page.
 * Single source of truth for radius, padding, icon size and gap.
 */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    className,
    variant = "rounded",
    busy = false,
    listening = false,
    showPhotoButton = true,
    showVoiceButton = true,
    showSubmitButton = false,
    submitLabel = "Qidirish",
    onSubmit,
    onPhotoFile,
    onVoice,
    rightSlot,
    onKeyDown,
    ...inputProps
  },
  ref,
) {
  const fileRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const radius = variant === "pill" ? "rounded-full" : "rounded-2xl";
  const minHeight = variant === "hero" ? "min-h-[52px] sm:min-h-[56px]" : "min-h-[44px]";

  return (
    <div
      className={cn(
        "group/search relative isolate flex min-w-0 items-center gap-2 overflow-hidden border-2 bg-white px-3.5 py-2 shadow-card transition-[border-color,box-shadow]",
        radius,
        minHeight,
        busy
          ? "scan-pulse border-electric-500 ring-glow-electric"
          : "border-border-default focus-within:border-electric-500/60 focus-within:shadow-hover focus-within:ring-glow-electric",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0 text-electric-500" />
      <input
        id={inputId}
        ref={ref}
        type="text"
        {...inputProps}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmit?.();
          }
          onKeyDown?.(event);
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent text-sm font-medium text-ink-900 outline-none placeholder:text-ink-500/80 max-sm:placeholder:text-xs",
          variant === "hero" && "text-base sm:text-lg",
        )}
      />

      {showPhotoButton ? (
        <>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            aria-label="Rasm yuklash"
            className="rounded-full p-2 text-ink-500 transition hover:bg-elevated hover:text-electric-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onPhotoFile?.(file);
              event.target.value = "";
            }}
          />
        </>
      ) : null}

      {showVoiceButton ? (
        <button
          type="button"
          onClick={onVoice}
          aria-label="Ovozli qidiruv"
          className={cn(
            "rounded-full p-2 transition",
            listening
              ? "bg-electric-500/15 text-electric-500"
              : "text-ink-500 hover:bg-elevated hover:text-electric-500",
          )}
        >
          <Mic className="h-4 w-4" />
        </button>
      ) : null}

      {rightSlot}

      {showSubmitButton ? (
        <motion.button
          type="button"
          onClick={onSubmit}
          whileTap={{ scale: 0.97 }}
          className={cn(
            "shrink-0 bg-gradient-electric px-4 py-2 text-xs font-bold text-white shadow-card transition hover:brightness-110",
            variant === "pill" ? "rounded-full" : "rounded-xl",
            variant === "hero" && "px-5 text-sm",
          )}
        >
          {submitLabel}
        </motion.button>
      ) : null}
    </div>
  );
});
