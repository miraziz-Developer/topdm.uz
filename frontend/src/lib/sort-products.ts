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
      return next.sort((a, b) => (b.view_count ?? 0) - (a.view_count ?? 0));
    case "newest":
      return next.sort((a, b) => b.id.localeCompare(a.id));
    case "relevance":
    default:
      return next;
  }
}
