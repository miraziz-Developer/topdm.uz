import type { DetectedOutfitItem, PhotoSearchResponse, Product, ShopSummary } from "@/types";

export const PHOTO_SEARCH_STORAGE_KEY = "bozor-photo-search-v22";
export const PHOTO_SEARCH_UPDATED_EVENT = "bozor-photo-search-updated";

export type PhotoSearchVision = PhotoSearchResponse["vision"];

export type PhotoSearchPayload = PhotoSearchResponse & {
  previewUrl: string;
};

const MIN_PRODUCT_MATCH_PCT = 35;
const MIN_OUTFIT_MATCH_PCT = 44;

export function readStoredPhotoSearch(): PhotoSearchPayload | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(PHOTO_SEARCH_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PhotoSearchPayload;
  } catch {
    return null;
  }
}

export function compactPhotoSearchForStorage(payload: PhotoSearchPayload): PhotoSearchPayload {
  return {
    ...payload,
    detected_items: payload.detected_items?.map((item) => ({
      ...item,
      vision: undefined,
    })),
  };
}

export function notifyPhotoSearchUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PHOTO_SEARCH_UPDATED_EVENT));
}

export function storePendingPhotoSearch(previewUrl: string): void {
  storePhotoSearch({
    items: [],
    total: 0,
    page: 1,
    previewUrl,
    query_label: "Rasm tahlil qilinmoqda…",
    detected_items: [],
    mode: "outfit_multi_fast",
    assistant_text: "",
    vision: {},
  });
}

export function storePhotoSearch(payload: PhotoSearchPayload): void {
  const compact = compactPhotoSearchForStorage(payload);
  try {
    sessionStorage.setItem(PHOTO_SEARCH_STORAGE_KEY, JSON.stringify(compact));
    notifyPhotoSearchUpdated();
  } catch {
    const minimal = {
      items: compact.items,
      total: compact.total,
      page: compact.page,
      vision: compact.vision,
      query_label: compact.query_label,
      mode: compact.mode,
      previewUrl: compact.previewUrl,
      assistant_text: compact.assistant_text,
      primary_detection_id: compact.primary_detection_id,
      detected_items: compact.detected_items?.map(({ products, id, total, bbox, thumbnail_url, refine_crop_url }) => ({
        id,
        label_uz: "visual",
        total,
        bbox,
        products,
        thumbnail_url: thumbnail_url ?? "",
        refine_crop_url: refine_crop_url ?? "",
        search_query: "",
      })),
    };
    sessionStorage.setItem(PHOTO_SEARCH_STORAGE_KEY, JSON.stringify(minimal));
  }
  notifyPhotoSearchUpdated();
}

export function clearStoredPhotoSearch(): void {
  sessionStorage.removeItem(PHOTO_SEARCH_STORAGE_KEY);
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    reader.readAsDataURL(file);
  });
}

export async function preparePhotoForUpload(file: File, maxEdge = 960): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 180_000) {
    return file;
  }
  const dataUrl = await readFileAsDataUrl(file);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Rasmni o'qib bo'lmadi"));
    img.src = dataUrl;
  });
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function isProductPhotoSearch(payload: PhotoSearchPayload | null): boolean {
  if (!payload) return false;
  if (payload.mode === "product_photo_fast") return true;
  return Boolean(payload.detected_items?.some((b) => b.id === "product"));
}

/** Noto'g'ri 3 zonali fallback (top/pants/shoes) — tovar fotosuratida ko'rsatilmaydi. */
export function isDefaultBodySlotSearch(payload: PhotoSearchPayload | null): boolean {
  if (!payload?.detected_items?.length) return false;
  const ids = new Set(payload.detected_items.map((item) => item.id));
  return ids.has("top") && ids.has("pants") && ids.has("shoes") && ids.size <= 4;
}

export function shouldShowPhotoSegmentPicker(payload: PhotoSearchPayload | null): boolean {
  if (!payload) return false;
  if (isProductPhotoSearch(payload) || isDefaultBodySlotSearch(payload)) return false;
  const blocks = getDetectedItems(payload);
  if (blocks.length <= 1) return false;
  return payload.mode === "outfit_multi" || payload.mode === "outfit_multi_fast";
}

export function getDetectedItems(payload: PhotoSearchPayload | null): DetectedOutfitItem[] {
  const items = payload?.detected_items?.length ? payload.detected_items : [];
  return items.filter((item) => item.id !== "whole");
}

export function pickDefaultDetectedId(payload: PhotoSearchPayload | null): string | null {
  if (!payload) return null;
  const blocks = getDetectedItems(payload);
  if (!blocks.length) return null;
  const primary = payload.primary_detection_id;
  if (primary && blocks.some((b) => b.id === primary)) {
    const block = blocks.find((b) => b.id === primary);
    const y = block?.bbox?.y ?? 0.5;
    if (y >= 0.18) return primary;
  }
  const score = (block: DetectedOutfitItem) => {
    const products = block.products ?? [];
    const match = products.length
      ? Math.max(...products.map((p) => p.visual_match_pct ?? 0))
      : 0;
    const y = block.bbox?.y ?? 0.5;
    const bodyPrior = y < 0.22 ? -40 : y < 0.55 ? 14 : y > 0.72 ? -4 : 6;
    const idPrior =
      block.id === "product" || block.id.startsWith("product_")
        ? 10
        : block.id === "top"
          ? 6
          : block.id === "pants"
            ? 4
            : block.id === "shoes"
              ? 2
              : 0;
    return match + bodyPrior + idPrior;
  };
  const best = [...blocks].sort((a, b) => score(b) - score(a))[0];
  return best?.id ?? blocks[0]?.id ?? null;
}

function normalizeProduct(raw: unknown): Product | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const id = String(p.id ?? "").trim();
  if (!id) return null;
  const shopRaw = p.shop;
  const shop: ShopSummary =
    shopRaw && typeof shopRaw === "object"
      ? (shopRaw as ShopSummary)
      : { id: "", name: "Do'kon", ipadrom: "Bozor", floor: "" };
  return {
    id,
    name: String(p.name ?? "Mahsulot"),
    price: Number(p.price ?? 0),
    images: Array.isArray(p.images) ? p.images.map((u) => String(u)) : [],
    category: p.category ? String(p.category) : undefined,
    is_available: p.is_available !== false,
    is_featured: Boolean(p.is_featured),
    view_count: typeof p.view_count === "number" ? p.view_count : undefined,
    is_fallback: Boolean(p.is_fallback),
    visual_match: Boolean(p.visual_match),
    visual_match_pct: typeof p.visual_match_pct === "number" ? p.visual_match_pct : undefined,
    match_mode: p.match_mode ? String(p.match_mode) : undefined,
    shop,
  };
}

function isTrustedMatch(p: Product): boolean {
  return (p.visual_match_pct ?? 0) >= 90 || p.match_mode === "phash";
}

function sortPhotoProducts(items: Product[], productPhoto = false): Product[] {
  const minPct = productPhoto ? MIN_PRODUCT_MATCH_PCT : MIN_OUTFIT_MATCH_PCT;
  const floorPct = productPhoto ? MIN_PRODUCT_MATCH_PCT : 30;
  const trusted = items.filter(isTrustedMatch);
  const rest = items.filter((p) => !isTrustedMatch(p));
  const strong = rest.filter((p) => (p.visual_match_pct ?? 0) >= minPct);
  const soft = rest.filter((p) => (p.visual_match_pct ?? 0) >= floorPct);
  const pool = [...trusted, ...(strong.length ? strong : soft.slice(0, 6))];
  const unique = new Map<string, Product>();
  for (const p of pool) unique.set(p.id, p);
  return [...unique.values()].sort((a, b) => {
    const av = a.visual_match ? 1 : 0;
    const bv = b.visual_match ? 1 : 0;
    if (av !== bv) return bv - av;
    return (b.visual_match_pct ?? 0) - (a.visual_match_pct ?? 0);
  });
}

export function photoSearchUsesFallback(payload: PhotoSearchPayload | null): boolean {
  if (!payload) return false;
  if (payload.is_fallback) return true;
  if (payload.items?.some((item) => item.is_fallback)) return true;
  return Boolean(payload.detected_items?.some((block) => block.is_fallback || block.products?.some((p) => p.is_fallback)));
}

export function patchDetectedBlockProducts(
  payload: PhotoSearchPayload,
  blockId: string,
  products: Product[],
): PhotoSearchPayload {
  const detected_items = payload.detected_items?.map((block) =>
    block.id === blockId ? { ...block, products, total: products.length } : block,
  );
  return { ...payload, detected_items, items: mergePhotoItems(detected_items, payload.items), total: products.length };
}

function mergePhotoItems(
  blocks: DetectedOutfitItem[] | undefined,
  flat: Product[] | undefined,
): Product[] {
  const pick = (list: unknown[]) =>
    list.map(normalizeProduct).filter((p): p is Product => Boolean(p));
  const fromBlocks = pick((blocks ?? []).flatMap((b) => b.products ?? []) as unknown[]);
  const fromFlat = pick((flat ?? []) as unknown[]);
  const seen = new Set<string>();
  const out: Product[] = [];
  for (const p of [...fromBlocks, ...fromFlat]) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}

export function productsForDetected(
  payload: PhotoSearchPayload | null,
  detectedId: string | null,
): { items: PhotoSearchPayload["items"]; label: string } {
  if (!payload) return { items: [], label: "" };
  const productPhoto = isProductPhotoSearch(payload);
  const blocks = getDetectedItems(payload);
  const pick = (list: unknown[]) =>
    list.map(normalizeProduct).filter((p): p is Product => Boolean(p));

  if (detectedId && blocks.length) {
    const block = blocks.find((b) => b.id === detectedId);
    if (block?.products?.length) {
      return { items: sortPhotoProducts(pick(block.products as unknown[]), productPhoto), label: "" };
    }
  }

  if (blocks.length) {
    const defaultId = pickDefaultDetectedId(payload);
    const block = (defaultId ? blocks.find((b) => b.id === defaultId) : null) ?? blocks.find((b) => b.products?.length);
    if (block?.products?.length) {
      return { items: sortPhotoProducts(pick(block.products as unknown[]), productPhoto), label: "" };
    }
  }

  const merged = sortPhotoProducts(
    mergePhotoItems(blocks, payload.items as Product[] | undefined),
    productPhoto,
  );
  return { items: merged, label: "" };
}
