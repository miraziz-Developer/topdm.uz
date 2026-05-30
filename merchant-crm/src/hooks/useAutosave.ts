"use client";

import { useEffect, useRef } from "react";

import { toast } from "sonner";

type UseAutosaveOptions<T> = {
  value: T;
  onSave: (value: T) => Promise<void>;
  delayMs?: number;
  enabled?: boolean;
  successMessage?: string;
};

export function useAutosave<T>({
  value,
  onSave,
  delayMs = 700,
  enabled = true,
  successMessage = "Avtomatik saqlandi",
}: UseAutosaveOptions<T>) {
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (first.current) {
      first.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      void onSave(value)
        .then(() => {
          toast.success(successMessage, { duration: 1800 });
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Saqlashda xatolik";
          toast.error(msg);
        });
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [value, onSave, delayMs, enabled, successMessage]);
}
