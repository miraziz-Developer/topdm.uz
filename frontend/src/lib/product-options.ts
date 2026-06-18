import { resolveProductImageUrl } from "@/lib/media";
import type { Product } from "@/types";

const LETTER_SIZE_ORDER: Record<string, number> = {
  XXS: 0,
  XS: 1,
  S: 2,
  M: 3,
  L: 4,
  XL: 5,
  XXL: 6,
  XXXL: 7,
};

export function sortSizes(sizes: string[]): string[] {
  const unique = Array.from(new Set(sizes.map((s) => s.trim()).filter(Boolean)));
  if (!unique.length) return [];
  if (unique.every((size) => /^\d+$/.test(size))) {
    return unique.sort((a, b) => Number(a) - Number(b));
  }
  if (unique.every((size) => LETTER_SIZE_ORDER[size.toUpperCase()] != null)) {
    return unique.sort(
      (a, b) => LETTER_SIZE_ORDER[a.toUpperCase()] - LETTER_SIZE_ORDER[b.toUpperCase()],
    );
  }
  return unique.sort((a, b) => a.localeCompare(b, "uz"));
}

export type ProductSelectionOptions = {
  size?: string;
  color?: string;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function normColor(value: string): string {
  return value.trim().toLowerCase();
}

function splitColorNames(value: string): string[] {
  const raw = value.trim();
  if (!raw) return [];
  const parts = raw
    .split(/[,;]+|\s+va\s+/i)
    .map((part) => part.trim().replace(/^[,.\s]+|[,.\s]+$/g, ""))
    .filter(Boolean);
  return parts.length ? parts : [raw];
}

function addColors(target: Set<string>, values: string[]) {
  for (const value of values) {
    for (const color of splitColorNames(value)) {
      target.add(color);
    }
  }
}

export function extractSizeMatrix(attrs: Record<string, unknown>): Record<string, string[]> {
  const raw = attrs.size_matrix;
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, string[]> = {};
  for (const [color, sizes] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(sizes)) continue;
    const list = sizes.map((s) => String(s).trim()).filter(Boolean);
    if (list.length) out[color] = list;
  }
  return out;
}

export function sizesForColor(product: Product, color?: string): string[] {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;
  const matrix = extractSizeMatrix(attrs);
  const all = extractSelectableOptions(product).sizes;

  if (!color?.trim()) return sortSizes(all);
  const direct = matrix[color];
  if (direct?.length) return sortSizes(direct);

  const normalized = normColor(color);
  for (const [key, sizes] of Object.entries(matrix)) {
    if (normColor(key) === normalized && sizes.length) return sortSizes(sizes);
  }

  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  for (const variant of variants) {
    if (!variant || typeof variant !== "object") continue;
    const vColor = String((variant as Record<string, unknown>).color ?? "").trim();
    if (normColor(vColor) !== normalized) continue;
    const sizes = (variant as Record<string, unknown>).sizes;
    if (Array.isArray(sizes) && sizes.length) {
      return sortSizes(sizes.map((s) => String(s).trim()).filter(Boolean));
    }
  }

  return sortSizes(all);
}

export function extractSelectableOptions(product: Product): { sizes: string[]; colors: string[] } {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;

  const sizes = new Set<string>([
    ...asStringArray(attrs.sizes),
    ...asStringArray(attrs.size_options),
    ...asStringArray(attrs.sizeValues),
  ]);
  const colors = new Set<string>();
  addColors(colors, asStringArray(attrs.colors));
  addColors(colors, asStringArray(attrs.color_options));
  addColors(colors, asStringArray(attrs.colorValues));

  const matrix = extractSizeMatrix(attrs);
  for (const list of Object.values(matrix)) {
    list.forEach((s) => sizes.add(s));
  }

  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  for (const variant of variants) {
    if (!variant || typeof variant !== "object") continue;
    const color = String((variant as Record<string, unknown>).color ?? "").trim();
    const variantSizes = (variant as Record<string, unknown>).sizes;
    if (Array.isArray(variantSizes)) {
      variantSizes.forEach((s) => {
        const t = String(s).trim();
        if (t) sizes.add(t);
      });
    }
    if (color) addColors(colors, [color]);
  }

  return {
    sizes: sortSizes(Array.from(sizes)),
    colors: Array.from(colors),
  };
}

export function selectionKey(options?: ProductSelectionOptions): string {
  if (!options) return "";
  const size = (options.size ?? "").trim();
  const color = (options.color ?? "").trim();
  return `size:${size}|color:${color}`;
}

export function selectionLabel(options?: ProductSelectionOptions): string {
  if (!options) return "";
  const parts: string[] = [];
  if (options.size) parts.push(`Razmer: ${options.size}`);
  if (options.color) parts.push(`Rang: ${options.color}`);
  return parts.join(", ");
}

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

function productSkus(product: Product): Array<Record<string, unknown>> {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;
  const skus = Array.isArray(attrs.skus) ? attrs.skus : [];
  return skus.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
}

/** Stock for a specific color+size SKU; null when no matching row exists. */
export function skuStockForSelection(
  product: Product,
  options?: ProductSelectionOptions,
): number | null {
  const color = (options?.color ?? "").trim();
  const size = (options?.size ?? "").trim();
  if (!color || !size) return null;

  for (const row of productSkus(product)) {
    const rowColor = String(row.color ?? "").trim();
    const rowSize = String(row.size ?? "").trim();
    if (normKey(rowColor) === normKey(color) && normKey(rowSize) === normKey(size)) {
      return Math.max(0, Number(row.stock) || 0);
    }
  }
  return null;
}

/** True when at least one SKU row carries stock > 0 (variant-level inventory is active). */
export function hasTrackedSkuStock(product: Product): boolean {
  return productSkus(product).some((row) => Math.max(0, Number(row.stock) || 0) > 0);
}

export function isSelectionInStock(product: Product, options?: ProductSelectionOptions): boolean {
  const total = Number(product.stock_count ?? 0);
  if (total <= 0) return false;

  // SKU rows exist but none have stock while aggregate stock_count > 0 — treat as unsynced.
  if (!hasTrackedSkuStock(product)) {
    return true;
  }

  const sku = skuStockForSelection(product, options);
  if (sku != null) return sku > 0;
  return total > 0;
}

function normalizeColorKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Rang → shu rangdagi rasmlar (galereya va tanlash uchun). */
export function colorImageMapFromProduct(product: Product): Record<string, string[]> {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;
  const map: Record<string, string[]> = {};

  const addImages = (color: string, images: string[]) => {
    if (!images.length) return;
    for (const name of splitColorNames(color)) {
      const key = normalizeColorKey(name);
      if (!key) continue;
      map[key] = Array.from(new Set([...(map[key] ?? []), ...images]));
    }
  };

  const directMap = attrs.color_images;
  if (directMap && typeof directMap === "object" && !Array.isArray(directMap)) {
    for (const [color, urls] of Object.entries(directMap as Record<string, unknown>)) {
      addImages(color, asStringArray(urls));
    }
  }

  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  for (const row of variants) {
    if (!row || typeof row !== "object") continue;
    const variant = row as Record<string, unknown>;
    const color = String(variant.color ?? "").trim();
    const images = asStringArray(variant.images);
    const single = String(variant.image ?? "").trim();
    if (single) images.push(single);
    addImages(color, images);
  }

  return map;
}

export function imagesForColor(product: Product, color?: string): string[] {
  const gallery = (product.images ?? [])
    .map((row) => String(row ?? "").trim())
    .filter(Boolean);

  if (!color?.trim()) return gallery;

  const map = colorImageMapFromProduct(product);
  const colorUrls = map[normalizeColorKey(color)] ?? [];

  const seen = new Set<string>();
  const merged: string[] = [];
  for (const entry of [...colorUrls, ...gallery]) {
    const url = String(entry ?? "").trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    merged.push(url);
  }
  return merged.length ? merged : gallery;
}

export function colorThumbnail(product: Product, color: string): string | undefined {
  const images = imagesForColor(product, color);
  const raw = images[0];
  return raw ? resolveProductImageUrl(raw) : undefined;
}

/** Rang + galereya — ProductImage fallback zanjiri uchun. */
export function galleryImagesForSelection(
  product: Product,
  options?: ProductSelectionOptions,
): string[] {
  return imagesForColor(product, options?.color);
}
