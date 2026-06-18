import type { Product } from "@/types";

export type ProductSortKey = "relevance" | "price_asc" | "price_desc" | "newest" | "popular";

export function sortProducts(items: Product[], sortBy: ProductSortKey): Product[] {
  const next = [...items];
  switch (sortBy) {
    case "price_asc":
      return next.sort((a, b) => a.price - b.price);
    case "price_desc":
      return next.sort((a, b) => b.price - a.price);
    case "popular":
      return next.sort(
        (a, b) =>
          (b.view_count ?? 0) - (a.view_count ?? 0) ||
          Number(b.is_featured) - Number(a.is_featured) ||
          b.id.localeCompare(a.id),
      );
    case "newest":
      return next.sort((a, b) => b.id.localeCompare(a.id));
    case "relevance":
    default:
      return next.sort((a, b) => {
        const scoreA = a.visual_match_pct ?? 0;
        const scoreB = b.visual_match_pct ?? 0;
        if (scoreA !== scoreB) return scoreB - scoreA;
        const featured = Number(b.is_featured) - Number(a.is_featured);
        if (featured !== 0) return featured;
        return (b.view_count ?? 0) - (a.view_count ?? 0);
      });
  }
}
