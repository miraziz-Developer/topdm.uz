"use client";

import { useCallback } from "react";

import { searchProductsByImage } from "@/lib/api";
import { usePhotoSearchUiStore } from "@/stores/photo-search-ui-store";
import { notifyPhotoSearchUpdated, storePhotoSearch } from "@/lib/photoSearch";
import type { PhotoSearchResponse } from "@/types";

function parseApiErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) {
    return "Rasm bo'yicha qidiruvda xatolik. Boshqa rasm yuborib ko'ring.";
  }
  const msg = err.message;
  if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
    return "Serverga ulanib bo'lmadi. Backend (port 8000) ishlayotganini tekshiring.";
  }
  if (msg.includes("502") || msg.includes("Image search failed")) {
    return "AI tahlil vaqtincha ishlamadi. Birozdan keyin qayta urinib ko'ring.";
  }
  if (msg.includes("413") || msg.includes("8MB")) {
    return "Rasm juda katta. Boshqa rasm yuboring (8MB dan kichik).";
  }
  return "Rasm bo'yicha qidiruvda xatolik. Boshqa rasm yuborib ko'ring.";
}

export function usePhotoSearch() {
  const isSearching = usePhotoSearchUiStore((s) => s.isSearching);
  const error = usePhotoSearchUiStore((s) => s.error);
  const setSearching = usePhotoSearchUiStore((s) => s.setSearching);
  const setError = usePhotoSearchUiStore((s) => s.setError);

  const searchByPhoto = useCallback(
    async (fileOrPrepared: File, previewUrl?: string): Promise<PhotoSearchResponse | null> => {
      setSearching(true);
      setError(null);
      try {
        const prepared = fileOrPrepared;
        const response = await searchProductsByImage(prepared, 1, 24, undefined, true);
        const preview = previewUrl ?? "";
        storePhotoSearch({
          ...response,
          previewUrl: preview,
        });
        notifyPhotoSearchUpdated();
        const hasResults =
          Boolean(response.detected_items?.length) ||
          Boolean(response.detected_items?.some((d) => d.products?.length));
        if (!hasResults) {
          setError("Rasm tahlil qilindi — mos mahsulot topilmadi. Boshqa rasm sinab ko'ring.");
        }
        return response;
      } catch (err) {
        const message = parseApiErrorMessage(err);
        setError(message);
        return null;
      } finally {
        setSearching(false);
      }
    },
    [setError, setSearching],
  );

  const clearError = useCallback(() => setError(null), [setError]);

  return { searchByPhoto, isSearching, error, clearError };
}
