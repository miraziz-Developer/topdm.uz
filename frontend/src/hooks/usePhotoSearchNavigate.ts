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
  const { searchByPhoto, isSearching, error, clearError } = usePhotoSearch();

  const runPhotoSearch = useCallback(
    async (file: File) => {
      clearStoredPhotoSearch();
      const prepared = await preparePhotoForUpload(file);
      const previewUrl = await readFileAsDataUrl(prepared);
      storePendingPhotoSearch(previewUrl);
      notifyPhotoSearchUpdated();
      router.push("/search?photo=1");
      return searchByPhoto(prepared, previewUrl);
    },
    [router, searchByPhoto],
  );

  return { runPhotoSearch, isSearching, error, clearError };
}
