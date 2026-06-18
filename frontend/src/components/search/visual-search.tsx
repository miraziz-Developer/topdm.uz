"use client";

import { useCallback, useState } from "react";

import { refineVisualSearchCategory } from "@/lib/api";
import type { DetectedOutfitItem, Product } from "@/types";

export type VisualCategorySearchOptions = {
  minPrice?: number | null;
  maxPrice?: number | null;
  intentText?: string | null;
};

export function useVisualCategorySearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCategorySearch = useCallback(
    async (
      item: Pick<
        DetectedOutfitItem,
        "label_uz" | "search_query" | "category" | "color" | "material" | "thumbnail_url" | "refine_crop_url"
      > & { crop_base64?: string | null },
      options?: VisualCategorySearchOptions,
    ): Promise<Product[]> => {
      setLoading(true);
      setError(null);
      try {
        const minPrice = options?.minPrice;
        const maxPrice = options?.maxPrice;
        const data = await refineVisualSearchCategory({
          label_uz: "visual",
          search_query: "visual",
          selected_category: null,
          color: null,
          material: null,
          intent_text: null,
          min_price: minPrice != null && minPrice > 0 ? Number(minPrice) : null,
          max_price: maxPrice != null && maxPrice > 0 ? Number(maxPrice) : null,
          crop_base64: item.crop_base64 ?? item.refine_crop_url ?? item.thumbnail_url ?? null,
        });
        return data.products ?? [];
      } catch {
        setError("Rasm bo'yicha qidiruvda xatolik.");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { handleCategorySearch, loading, error, clearError: () => setError(null) };
}
