import type { Product } from "@/types";

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

  if (!color?.trim()) return all;
  const direct = matrix[color];
  if (direct?.length) return direct;

  const normalized = normColor(color);
  for (const [key, sizes] of Object.entries(matrix)) {
    if (normColor(key) === normalized && sizes.length) return sizes;
  }

  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  for (const variant of variants) {
    if (!variant || typeof variant !== "object") continue;
    const vColor = String((variant as Record<string, unknown>).color ?? "").trim();
    if (normColor(vColor) !== normalized) continue;
    const sizes = (variant as Record<string, unknown>).sizes;
    if (Array.isArray(sizes) && sizes.length) {
      return sizes.map((s) => String(s).trim()).filter(Boolean);
    }
  }

  return all;
}

export function extractSelectableOptions(product: Product): { sizes: string[]; colors: string[] } {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;

  const sizes = new Set<string>([
    ...asStringArray(attrs.sizes),
    ...asStringArray(attrs.size_options),
    ...asStringArray(attrs.sizeValues),
  ]);
  const colors = new Set<string>([
    ...asStringArray(attrs.colors),
    ...asStringArray(attrs.color_options),
    ...asStringArray(attrs.colorValues),
  ]);

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
    if (color) colors.add(color);
  }

  return {
    sizes: Array.from(sizes),
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

/** Stock for a specific color+size SKU; falls back to product.stock_count. */
export function skuStockForSelection(
  product: Product,
  options?: ProductSelectionOptions,
): number | null {
  const color = (options?.color ?? "").trim();
  const size = (options?.size ?? "").trim();
  if (!color || !size) return null;

  const attrs = (product.attributes ?? {}) as Record<string, unknown>;
  const skus = Array.isArray(attrs.skus) ? attrs.skus : [];
  for (const row of skus) {
    if (!row || typeof row !== "object") continue;
    const rowColor = String((row as Record<string, unknown>).color ?? "").trim();
    const rowSize = String((row as Record<string, unknown>).size ?? "").trim();
    if (normKey(rowColor) === normKey(color) && normKey(rowSize) === normKey(size)) {
      return Math.max(0, Number((row as Record<string, unknown>).stock) || 0);
    }
  }
  return null;
}

export function isSelectionInStock(product: Product, options?: ProductSelectionOptions): boolean {
  const sku = skuStockForSelection(product, options);
  if (sku != null) return sku > 0;
  const total = Number(product.stock_count ?? 0);
  return total > 0;
}
