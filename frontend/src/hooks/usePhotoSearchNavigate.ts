"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { usePhotoSearch } from "@/hooks/usePhotoSearch";
import {
  clearStoredPhotoSearch,
  notifyPhotoSearchUpdated,
  preparePhotoForUpload,
  readFileAsDataUrl,
  storePendingPhotoSearch,
} from "@/lib/photoSearch";

/** Rasm yuklash → darhol /search?photo=1 → API (race condition yo'q). */
export function usePhotoSearchNavigate() {
  const router = useRouter();
  const { searchByPhoto, isSearching, error, clearError, reportError } = usePhotoSearch();

  const runPhotoSearch = useCallback(
    async (file: File) => {
      try {
        clearStoredPhotoSearch();
        const prepared = await preparePhotoForUpload(file);
        const previewUrl = await readFileAsDataUrl(prepared);
        storePendingPhotoSearch(previewUrl);
        notifyPhotoSearchUpdated();
        router.push("/search?photo=1");
        return await searchByPhoto(prepared, previewUrl);
      } catch (err) {
        reportError(err instanceof Error ? err.message : "Rasmni o'qib bo'lmadi. Boshqa rasm tanlang.");
        return null;
      }
    },
    [reportError, router, searchByPhoto],
  );

  return { runPhotoSearch, isSearching, error, clearError };
}
