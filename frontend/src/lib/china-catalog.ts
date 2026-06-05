import { getJson } from "@/lib/api";
import type { Product } from "@/types";

export type ChinaCatalogItem = {
  item_id: string;
  title: string;
  image_url: string;
  total_price_uzs: number;
  base_price_cny?: number;
  source_url?: string | null;
};

export type ChinaCatalogResponse = {
  items: ChinaCatalogItem[];
  errors?: string[];
};

/** Taobao API orqali vitrina (asosiy + ixtiyoriy qo'shimcha IDlar). */
export async function fetchChinaCatalog(extraIds?: string[]): Promise<ChinaCatalogResponse> {
  const params = new URLSearchParams();
  if (extraIds?.length) params.set("ids", extraIds.join(","));
  const qs = params.toString();
  return getJson<ChinaCatalogResponse>(`/market/china/catalog${qs ? `?${qs}` : ""}`);
}

/** Bitta ID/havola orqali import (qidiruv). */
export async function importChinaProductById(rawId: string): Promise<ChinaCatalogItem> {
  const encoded = encodeURIComponent(rawId.trim());
  const res = await getJson<{ item: ChinaCatalogItem }>(`/market/china/import/${encoded}`);
  return res.item;
}

export function chinaCatalogItemToProduct(item: ChinaCatalogItem): Product {
  const image = item.image_url?.trim();
  const images = image ? [image] : [];
  return {
    id: `china:${item.item_id}`,
    name: item.title || "Xitoy tovari",
    price: item.total_price_uzs,
    price_uzs: item.total_price_uzs,
    images,
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
