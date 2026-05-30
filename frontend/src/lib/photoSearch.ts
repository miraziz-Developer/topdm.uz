import type { DetectedOutfitItem, PhotoSearchResponse, Product, ShopSummary } from "@/types";

export const PHOTO_SEARCH_STORAGE_KEY = "bozor-photo-search-v7";
export const PHOTO_SEARCH_UPDATED_EVENT = "bozor-photo-search-updated";

export type PhotoSearchVision = PhotoSearchResponse["vision"];

export type PhotoSearchPayload = PhotoSearchResponse & {
  previewUrl: string;
};

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

/** Strip heavy base64 crops so sessionStorage stays under quota (~5MB). */
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
      detected_items: compact.detected_items?.map(({ products, id, label_uz, total, bbox }) => ({
        id,
        label_uz,
        total,
        bbox,
        products,
        thumbnail_url: "",
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

/** Compress large phone photos before upload (Taobao-style pipeline). */
export async function preparePhotoForUpload(file: File, maxEdge = 720): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < 200_000) {
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
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.78));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function getDetectedItems(payload: PhotoSearchPayload | null): DetectedOutfitItem[] {
  return payload?.detected_items?.length ? payload.detected_items : [];
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
  const flat = detected_items?.flatMap((b) => b.products) ?? payload.items;
  const seen = new Set<string>();
  const items = flat.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
  return { ...payload, detected_items, items, total: items.length };
}

const SLOT_KEYWORDS: Record<string, string[]> = {
  kamar: ["kamar", "belbog", "belt"],
  belt: ["kamar", "belbog", "belt"],
  shim: ["shim", "jinsi", "pant", "chino"],
  pants: ["shim", "jinsi", "pant", "chino"],
  kurtka: ["kurtka", "jacket", "palto", "blazer"],
  "ko'ylak": ["ko'ylak", "koylak", "shirt", "futbolka", "sviter"],
  koylak: ["ko'ylak", "koylak", "shirt", "futbolka"],
  poyabzal: ["poyabzal", "krossovka", "tufli", "oyoq", "bot"],
  bot: ["poyabzal", "krossovka", "tufli"],
};

const SLOT_BLOCK: Record<string, string[]> = {
  kamar: ["mato", "ko'rpa", "korpa", "pardabop", "tufli", "krossovka", "poyabzal", "bolalar", "maktab", "atir", "sarpo", "soat", "watch"],
  belt: ["mato", "ko'rpa", "pardabop", "tufli", "krossovka", "bolalar", "maktab", "soat", "watch"],
  shim: ["soat", "watch", "qo'l soat", "smart", "atir", "parfyum", "mato", "ko'rpa", "tufli", "krossovka", "poyabzal"],
  pants: ["soat", "watch", "atir", "mato", "ko'rpa", "tufli", "krossovka", "poyabzal"],
  kurtka: ["soat", "watch", "shim", "tufli", "mato", "ko'rpa"],
  "ko'ylak": ["soat", "watch", "shim", "tufli", "mato", "ko'rpa"],
};

function filterProductsForSlot(label: string, items: Product[]): Product[] {
  const key = label.trim().toLowerCase();
  const slotKey =
    Object.keys(SLOT_KEYWORDS).find((k) => key.includes(k) || k.includes(key)) ?? "";
  const must = SLOT_KEYWORDS[slotKey];
  const block = SLOT_BLOCK[slotKey] ?? [];
  if (!must?.length) return items;

  const filtered = items.filter((p) => {
    const hay = `${p.name} ${p.category ?? ""}`.toLowerCase();
    if (block.some((b) => hay.includes(b))) return false;
    return must.some((kw) => hay.includes(kw));
  });
  return filtered;
}

export function productsForDetected(
  payload: PhotoSearchPayload | null,
  detectedId: string | null,
): { items: PhotoSearchPayload["items"]; label: string } {
  if (!payload) return { items: [], label: "" };
  const blocks = getDetectedItems(payload);
  const pick = (list: unknown[]) =>
    list.map(normalizeProduct).filter((p): p is Product => Boolean(p));
  if (detectedId && blocks.length) {
    const block = blocks.find((b) => b.id === detectedId);
    if (block) {
      const items = sortPhotoProducts(pick(block.products as unknown[]), block.label_uz);
      return { items, label: block.label_uz };
    }
  }
  if (blocks.length) {
    const block = blocks[0];
    const items = sortPhotoProducts(pick(block.products as unknown[]), block.label_uz);
    return { items, label: block.label_uz };
  }
  return { items: [], label: payload.query_label };
}

function sortPhotoProducts(items: Product[], label: string): Product[] {
  const filtered = filterProductsForSlot(label, items);
  return [...filtered].sort((a, b) => {
    const av = a.visual_match ? 1 : 0;
    const bv = b.visual_match ? 1 : 0;
    if (av !== bv) return bv - av;
    return (b.visual_match_pct ?? 0) - (a.visual_match_pct ?? 0);
  });
}
