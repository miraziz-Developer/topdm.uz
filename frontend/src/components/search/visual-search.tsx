"use client";

import { useCallback, useState } from "react";

import { refineVisualSearchCategory } from "@/lib/api";
import { mapVisualCategoryLabel } from "@/lib/visual-search-category";
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
        "label_uz" | "search_query" | "category" | "color" | "material" | "thumbnail_url"
      >,
      options?: VisualCategorySearchOptions,
    ): Promise<Product[]> => {
      setLoading(true);
      setError(null);
      try {
        const cleanCategory = mapVisualCategoryLabel(item.label_uz, item.category);
        const minPrice = options?.minPrice;
        const maxPrice = options?.maxPrice;
        const data = await refineVisualSearchCategory({
          label_uz: item.label_uz,
          search_query: item.search_query || item.label_uz,
          selected_category: cleanCategory,
          color: item.color ?? null,
          material: item.material ?? null,
          intent_text: options?.intentText ?? null,
          min_price: minPrice != null && minPrice > 0 ? Number(minPrice) : null,
          max_price: maxPrice != null && maxPrice > 0 ? Number(maxPrice) : null,
          crop_base64: item.thumbnail_url || null,
        });
        return data.products ?? [];
      } catch {
        setError("Kategoriya bo'yicha qidiruvda xatolik.");
        return [];
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return { handleCategorySearch, loading, error, clearError: () => setError(null) };
}
