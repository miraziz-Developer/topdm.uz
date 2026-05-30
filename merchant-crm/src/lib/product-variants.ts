export type VariantColorRow = {
  id: string;
  name: string;
  sizes: string[];
  imageUrls: string[];
  imageFiles: File[];
};

export type VariantCatalog = {
  allSizes: string[];
  colors: VariantColorRow[];
  skuStock: Record<string, number>;
};

export const DEFAULT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"];

export function skuKey(color: string, size: string): string {
  return `${color.trim().toLowerCase()}|${size.trim().toLowerCase()}`;
}

export function emptyVariantCatalog(): VariantCatalog {
  return { allSizes: ["S", "M", "L", "XL"], colors: [], skuStock: {} };
}

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

export function parseVariantCatalogFromAttributes(attrs?: Record<string, unknown> | null): VariantCatalog {
  if (!attrs) return emptyVariantCatalog();
  const sizeMatrix = (attrs.size_matrix ?? {}) as Record<string, string[]>;
  const skuStock: Record<string, number> = {};
  const allSizes = new Set<string>();

  const skus = Array.isArray(attrs.skus) ? attrs.skus : [];
  for (const row of skus) {
    if (!row || typeof row !== "object") continue;
    const color = String((row as Record<string, unknown>).color ?? "").trim();
    const size = String((row as Record<string, unknown>).size ?? "").trim();
    if (!color || !size) continue;
    skuStock[skuKey(color, size)] = Math.max(0, Number((row as Record<string, unknown>).stock) || 0);
    allSizes.add(size);
  }

  const colors: VariantColorRow[] = [];
  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  const seen = new Set<string>();
  for (const row of variants) {
    if (!row || typeof row !== "object") continue;
    const name = String((row as Record<string, unknown>).color ?? "").trim();
    if (!name) continue;
    seen.add(normKey(name));
    const sizes = Array.isArray((row as Record<string, unknown>).sizes)
      ? ((row as Record<string, unknown>).sizes as unknown[]).map((s) => String(s).trim()).filter(Boolean)
      : (sizeMatrix[name] ?? []);
    sizes.forEach((s) => allSizes.add(s));
    const images = (row as Record<string, unknown>).images;
    const imageUrls = Array.isArray(images)
      ? images.map((u) => String(u).trim()).filter(Boolean)
      : [];
    colors.push({ id: crypto.randomUUID(), name, sizes, imageUrls, imageFiles: [] });
  }

  const colorImages = (attrs.color_images ?? {}) as Record<string, string[]>;
  for (const [name, urls] of Object.entries(colorImages)) {
    const c = name.trim();
    if (!c || seen.has(normKey(c))) continue;
    colors.push({
      id: crypto.randomUUID(),
      name: c,
      sizes: sizeMatrix[c] ?? [],
      imageUrls: Array.isArray(urls) ? urls.map((u) => String(u).trim()).filter(Boolean) : [],
      imageFiles: [],
    });
  }

  for (const s of [...(Array.isArray(attrs.sizes) ? attrs.sizes : []), ...(Array.isArray(attrs.size_options) ? attrs.size_options : [])]) {
    const t = String(s).trim();
    if (t) allSizes.add(t);
  }

  return {
    allSizes: allSizes.size ? [...allSizes] : ["S", "M", "L", "XL"],
    colors,
    skuStock,
  };
}

export function parseVariantCatalogFromProduct(
  raw?: {
    all_sizes?: string[];
    colors?: Array<{ name: string; sizes: string[]; image_urls?: string[] }>;
    sku_stock?: Record<string, number>;
  } | null,
): VariantCatalog {
  if (!raw) return emptyVariantCatalog();
  return {
    allSizes: raw.all_sizes?.length ? [...raw.all_sizes] : ["S", "M", "L", "XL"],
    colors: (raw.colors ?? []).map((c) => ({
      id: crypto.randomUUID(),
      name: c.name,
      sizes: [...(c.sizes ?? [])],
      imageUrls: [...(c.image_urls ?? [])],
      imageFiles: [],
    })),
    skuStock: { ...(raw.sku_stock ?? {}) },
  };
}

export function catalogToPayload(catalog: VariantCatalog, fallbackStock?: number) {
  return {
    all_sizes: catalog.allSizes,
    colors: catalog.colors.map((c) => ({
      name: c.name.trim(),
      sizes: c.sizes,
      image_urls: c.imageUrls,
    })),
    sku_stock: catalog.skuStock,
    fallback_stock: fallbackStock,
  };
}

export function totalSkuStock(catalog: VariantCatalog): number {
  return Object.values(catalog.skuStock).reduce((a, b) => a + (Number(b) || 0), 0);
}
