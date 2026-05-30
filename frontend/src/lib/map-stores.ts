import { resolveStorePosition } from "@/lib/geo/market-geo";
import { parseMerchantLocation } from "@/lib/map/merchant-location";
import type { MapShopMarker } from "@/lib/shop-location";
import { normalizeStallSlot, parseShopLocation, stallMapPoint } from "@/lib/shop-location";

export type MapStoreRecord = {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  floor: number;
  block_id: string;
  stall_number: string;
  status: string;
  rating: number;
  review_count: number;
  ipadrom: string;
  address_label: string;
  location_comment?: string | null;
  row_label?: string | null;
  shop_number?: string | null;
  market_zone?: string | null;
  building?: string | null;
  block_id_letter?: string | null;
  floor_level_label?: string | null;
  map_x: number;
  map_y: number;
};

export type MapStoresResponse = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id: string;
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
  stores: MapStoreRecord[];
  cached?: boolean;
  market_slug?: string;
};

export function mapStoreToMarker(store: MapStoreRecord): MapShopMarker {
  const loc = parseMerchantLocation({
    ipadrom: store.ipadrom,
    market_zone: store.market_zone ?? store.ipadrom,
    block_sector: store.building ?? undefined,
    floor: store.row_label ?? store.floor_level_label ?? undefined,
    section: store.shop_number ?? `rasta ${store.stall_number}`,
    location_comment: store.location_comment,
    location_label: store.address_label,
  });

  const floor = store.floor === 2 ? 2 : loc.floorLevel ?? 1;
  const pin = parseShopLocation({
    floor: `${floor}-qavat`,
    ipadrom: loc.market,
    block_sector: loc.building ?? (loc.blockLetter ? `${loc.blockLetter}-blok` : store.block_id),
    section: store.shop_number ?? `rasta ${store.stall_number}`,
  });
  pin.block = (store.block_id_letter ?? loc.blockLetter ?? store.block_id).toUpperCase();
  pin.stall = loc.stallNumber !== "—" ? loc.stallNumber : store.stall_number;
  pin.stallSlot = normalizeStallSlot(pin.stall, pin.block);
  pin.label = store.address_label || loc.addressLabel;
  if (loc.floorLevel) pin.floor = loc.floorLevel as 1 | 2;

  const hasCoords = Number.isFinite(store.map_x) && Number.isFinite(store.map_y) && store.map_x > 0;
  const point = hasCoords ? { x: store.map_x, y: store.map_y } : stallMapPoint(pin);
  const { lat, lng } = resolveStorePosition(store);

  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    ipadrom: loc.market,
    floor: loc.floorLevel != null ? `${loc.floorLevel}-qavat` : `${floor}-qavat`,
    pin,
    point,
    lat,
    lng,
    rating: store.rating,
    logo_url: store.logo_url,
    addressLabel: store.address_label || loc.addressLabel,
    locationComment: store.location_comment ?? loc.locationComment,
    rowLabel: store.row_label ?? loc.row,
    shopNumber: store.shop_number || store.stall_number,
    marketZone: store.market_zone ?? loc.market,
    building: store.building ?? loc.building,
    blockLetter: store.block_id_letter ?? loc.blockLetter,
    aisle: store.row_label ?? loc.row,
    floorLevelLabel: store.floor_level_label ?? (loc.floorLevel != null ? `${loc.floorLevel}-qavat` : null),
  };
}

export function mapStoresToMarkers(stores: MapStoreRecord[]): MapShopMarker[] {
  const seen = new Set<string>();
  const markers: MapShopMarker[] = [];
  for (const store of stores) {
    if (!store?.id || seen.has(store.id)) continue;
    seen.add(store.id);
    markers.push(mapStoreToMarker(store));
  }
  return markers;
}

export type MapFocusQuery = {
  merchantId?: string | null;
  shopSlug?: string | null;
  block?: string | null;
  stall?: string | null;
};

/** Buyurtma/mahsulot `block_sector` matnidan blok harfi (A–D). */
export function parseBlockLetterFromSector(raw?: string | null): string | undefined {
  if (!raw?.trim()) return undefined;
  const text = raw.trim();
  const m =
    text.match(/(?:^|[\s,])([A-D])\s*-?\s*blok/i) ||
    text.match(/\bblok\s*([A-D])\b/i) ||
    text.match(/\b([A-D])\s*-?\s*blok/i);
  return m?.[1]?.toUpperCase();
}

export function buildMapFocusHref(params: {
  merchantId: string;
  shopSlug?: string | null;
  block?: string;
  stall?: string;
  lat?: number;
  lng?: number;
  focus?: boolean;
  source?: "order" | "product" | "search" | "chat";
  orderId?: string;
}): string {
  const search = new URLSearchParams();
  search.set("merchant_id", params.merchantId);
  if (params.orderId) search.set("order_id", params.orderId);
  if (params.shopSlug) search.set("shop", params.shopSlug);
  if (params.block) search.set("block", params.block);
  if (params.stall) search.set("stall", params.stall);
  if (params.lat != null) search.set("lat", String(params.lat));
  if (params.lng != null) search.set("lng", String(params.lng));
  if (params.focus !== false) search.set("focus", "true");
  if (params.source) search.set("source", params.source);
  return `/map?${search.toString()}`;
}

export function orderShopMapHref(shop: {
  id: string;
  slug?: string | null;
  floor?: string | null;
  section?: string | null;
  block_sector?: string | null;
  ipadrom?: string | null;
}): string {
  const pin = parseShopLocation({
    floor: shop.floor || shop.block_sector || "",
    ipadrom: shop.ipadrom || "",
    block_sector: shop.block_sector,
    section: shop.section,
  });
  return buildMapFocusHref({
    merchantId: shop.id,
    shopSlug: shop.slug,
    block: pin.block,
    stall: pin.stall,
    focus: true,
    source: "order",
  });
}

export function buildMapFocusHrefFromMarker(marker: MapShopMarker): string {
  return buildMapFocusHref({
    merchantId: marker.id,
    block: marker.pin.block,
    stall: marker.pin.stall,
    lat: marker.lat,
    lng: marker.lng,
    focus: true,
  });
}

export function markerMatchesFocusQuery(marker: MapShopMarker, query: MapFocusQuery): boolean {
  const merchantId = query.merchantId?.trim();
  const shopSlug = query.shopSlug?.trim();

  if (merchantId) {
    if (marker.id === merchantId || marker.id.toLowerCase() === merchantId.toLowerCase()) {
      return true;
    }
  }
  if (shopSlug && marker.slug && marker.slug === shopSlug) {
    return true;
  }

  // ID yoki slug berilgan bo‘lsa — blok bo‘yicha taxmin qilmaymiz (Anor Boutique chalkashligi).
  if (merchantId || shopSlug) {
    return false;
  }

  if (query.block) {
    const block = query.block.toUpperCase();
    const stallSlot = query.stall ? normalizeStallSlot(query.stall, block) : null;
    if (marker.pin.block.toUpperCase() !== block) return false;
    if (stallSlot) {
      const markerSlot = marker.pin.stallSlot || normalizeStallSlot(marker.pin.stall, block);
      return markerSlot === stallSlot;
    }
    return true;
  }
  return false;
}

/** Mahsulot/buyurtma linkidan to‘g‘ri do‘kon — avval id, keyin slug. */
export function resolveFocusMarkerFromQuery(
  markers: MapShopMarker[],
  query: MapFocusQuery,
): MapShopMarker | null {
  if (!markers.length) return null;

  const merchantId = query.merchantId?.trim();
  if (merchantId) {
    const byId = markers.find(
      (m) => m.id === merchantId || m.id.toLowerCase() === merchantId.toLowerCase(),
    );
    if (byId) return byId;
  }

  const shopSlug = query.shopSlug?.trim();
  if (shopSlug) {
    const bySlug = markers.find((m) => m.slug === shopSlug);
    if (bySlug) return bySlug;
  }

  if (merchantId || shopSlug) {
    return null;
  }

  return markers.find((m) => markerMatchesFocusQuery(m, query)) ?? null;
}
