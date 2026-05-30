"use client";

import type { ReactNode } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useRef } from "react";

import { usePhotoSearchNavigate } from "@/hooks/usePhotoSearchNavigate";
import { cn } from "@/lib/utils";

type PhotoSearchButtonProps = {
  className?: string;
  inputId?: string;
  title?: string;
  onBeforeSearch?: () => void;
  onSearchComplete?: () => void;
  onSearchError?: (message: string) => void;
  children?: ReactNode;
};

export function PhotoSearchButton({
  className,
  inputId = "photo-search-input",
  title = "Rasm orqali qidirish",
  onBeforeSearch,
  onSearchComplete,
  onSearchError,
  children,
}: PhotoSearchButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { runPhotoSearch, isSearching } = usePhotoSearchNavigate();

  const handleFile = async (file: File | null) => {
    if (!file || isSearching) return;
    onBeforeSearch?.();
    const result = await runPhotoSearch(file);
    if (!result) {
      onSearchError?.("Rasm bo'yicha qidiruvda xatolik. Backend ishlayotganini tekshiring.");
      return;
    }
    onSearchComplete?.();
  };

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          void handleFile(file);
          event.target.value = "";
        }}
      />
      <button
        type="button"
        title={title}
        aria-label={title}
        disabled={isSearching}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "rounded-full p-2 text-text-400 transition-colors hover:bg-elevated hover:text-text-100 disabled:cursor-wait disabled:opacity-70",
          className,
        )}
      >
        {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : children ?? <Camera className="h-5 w-5" />}
      </button>
    </>
  );
}
