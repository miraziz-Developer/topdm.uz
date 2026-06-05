import { getJson } from "@/lib/api";
import { ApiError } from "@/lib/http-client";
import { formatUzs } from "@/lib/premium-market";
import type { Product } from "@/types";

export type AutoSearchItem = {
  item_id: string;
  title: string;
  image_url: string;
  price_cny: number;
  total_price_uzs: number;
  source_url?: string | null;
};

export type AutoSearchResponse = {
  query: string;
  translated_query: string;
  page: number;
  items: AutoSearchItem[];
};

export async function fetchChinaAutoSearch(query: string, page = 1): Promise<AutoSearchResponse> {
  const params = new URLSearchParams({ q: query.trim(), page: String(page) });
  return getJson<AutoSearchResponse>(`/market/auto-search?${params.toString()}`, false, true);
}

/** API xatosini foydalanuvchiga tushunarli qilib qaytaradi */
export function formatChinaSearchError(err: unknown): string {
  const apiErr = err instanceof ApiError ? err : null;
  const msg = apiErr?.message ?? (err instanceof Error ? err.message : "");
  const status = apiErr?.status ?? 0;
  if (status === 403 || /obunasi yo'q|not subscribed/i.test(msg)) {
    return "Taobao DataHub obunasi yo'q. RapidAPI sahifasida «Subscribe to Test» ni bosing, keyin qayta qidiring.";
  }
  if (status === 503 || /RAPIDAPI_KEY sozlanmagan|config_missing/i.test(msg)) {
    return "RAPIDAPI_KEY sozlanmagan. Loyiha `.env` fayliga Taobao DataHub kalitini qo'shing va backendni qayta ishga tushiring.";
  }
  if (status === 429 || /limiti/i.test(msg)) {
    return "Juda ko'p so'rov — 10 soniyadan keyin qayta urinib ko'ring.";
  }
  if (status === 404 && /not found/i.test(msg)) {
    return "Qidiruv API topilmadi. `docker compose restart backend` buyrug'ini bajaring.";
  }
  if (status === 502 || /upstream|taobao/i.test(msg)) {
    return msg || "Taobao qidiruv vaqtincha ishlamayapti. Boshqa so'z bilan urinib ko'ring.";
  }
  return msg || "Qidiruv xatosi. Keyinroq urinib ko'ring.";
}

export function autoSearchItemToProduct(item: AutoSearchItem): Product {
  const image = item.image_url?.trim();
  return {
    id: `china:${item.item_id}`,
    name: item.title,
    price: item.total_price_uzs,
    price_uzs: item.total_price_uzs,
    images: image ? [image] : [],
    sale_type: "Chakana",
    is_available: true,
    market_source: "china",
    detail_path: `/market/china/${encodeURIComponent(item.item_id)}`,
    category: "Xitoy",
    shop: {
      id: "taobao",
      name: "Taobao",
      ipadrom: "Xitoy",
      floor: "",
      location_label: "Xitoydan yetkaziladi",
    },
  };
}

export { formatUzs };
