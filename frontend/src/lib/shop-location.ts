import { indoorPixelToWgs84 } from "@/lib/geo/market-geo";
import { parseMerchantLocation } from "@/lib/map/merchant-location";
import type { ShopSummary } from "@/types";

export type IppodromPin = {
  block: string;
  stall: string;
  stallSlot: string;
  floor: 1 | 2;
  label: string;
};

export type MapPoint = {
  x: number;
  y: number;
};

export type MapShopMarker = {
  id: string;
  name: string;
  slug?: string;
  ipadrom: string;
  floor: string;
  pin: IppodromPin;
  point: MapPoint;
  lat: number;
  lng: number;
  rating?: number;
  logo_url?: string | null;
  /** To‘liq manzil matni (masalan: 1-qavat • B-blok • rasta 112). */
  addressLabel?: string | null;
  /** Qator / yo‘lak / izoh (merchant location_comment). */
  locationComment?: string | null;
  rowLabel?: string | null;
  shopNumber?: string;
  marketZone?: string | null;
  building?: string | null;
  blockSector?: string | null;
  blockLetter?: string | null;
  aisle?: string | null;
  floorLevelLabel?: string | null;
};

const BLOCKS = ["A", "B", "C", "D"] as const;
export const STALL_SLOTS = ["08", "12", "16", "20", "24", "28"] as const;

type LocationInput = Pick<ShopSummary, "floor" | "ipadrom"> & {
  block_sector?: string | null;
  section?: string | null;
};

/** Map backend `stall_number` / rasta text to fixture stall codes (08, 12, …). */
export function normalizeStallSlot(stallNumber: string, block?: string): string {
  const trimmed = stallNumber.trim();
  if (STALL_SLOTS.includes(trimmed as (typeof STALL_SLOTS)[number])) {
    return trimmed;
  }

  const numeric = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(numeric)) {
    return STALL_SLOTS[blockIndex(block || "B") % STALL_SLOTS.length];
  }

  let best: string = STALL_SLOTS[0];
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const code of STALL_SLOTS) {
    const diff = Math.abs(Number.parseInt(code, 10) - numeric);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = code;
    }
  }
  return best;
}

export function parseShopLocation(shop: LocationInput): IppodromPin {
  const raw = `${shop.floor || ""} ${shop.block_sector || ""} ${shop.section || ""} ${shop.ipadrom || ""}`.trim();
  const blockMatch =
    raw.match(/(?:^|[\s,])([A-D])\s*-?\s*blok/i) ||
    raw.match(/\bblok\s*([A-D])\b/i) ||
    raw.match(/\b([A-D])\s*-?\s*blok/i) ||
    raw.match(/\b([A-D])\d{1,3}\b/i);
  const stallMatch =
    raw.match(/rasta\s*(\d{1,3})/i) ||
    raw.match(/\b(\d{1,3})\s*-?\s*rasta/i) ||
    raw.match(/\b(\d{1,3})\s*-?\s*do['’`]?kon/i) ||
    (shop.section ? raw.match(/\b(\d{1,3})\b/) : null);

  const floorRaw = shop.floor || "";
  const floor: 1 | 2 =
    floorRaw.includes("2-qavat") || floorRaw.includes("2 qavat")
      ? 2
      : /2/.test(floorRaw) && !/1-?qavat/.test(floorRaw)
        ? 2
        : 1;

  const block = (blockMatch?.[1] || shop.block_sector?.trim().charAt(0) || "B").toUpperCase();
  const safeBlock = BLOCKS.includes(block as (typeof BLOCKS)[number]) ? block : "B";
  const stallRaw = stallMatch?.[1] || shop.section?.match(/\d{1,3}/)?.[0] || String(8 + (safeBlock.charCodeAt(0) % 4) * 3);
  const stallSlot = normalizeStallSlot(stallRaw, safeBlock);

  return {
    block: safeBlock,
    stall: stallRaw,
    stallSlot,
    floor,
    label: `${floor}-qavat • ${safeBlock}-blok • rasta ${stallRaw}`,
  };
}

export function blockIndex(block: string) {
  const index = BLOCKS.indexOf(block.toUpperCase() as (typeof BLOCKS)[number]);
  return index >= 0 ? index : 1;
}

/** Aligns with `markets/ippodrom.ts` stall grid — center of stall cell. */
export function stallMapPoint(pin: Pick<IppodromPin, "block" | "stall" | "stallSlot">): MapPoint {
  const blockIdx = blockIndex(pin.block);
  const xBase = 20 + blockIdx * 98;
  const slotCode = pin.stallSlot || normalizeStallSlot(pin.stall, pin.block);
  const slotIndex = Math.max(0, STALL_SLOTS.indexOf(slotCode as (typeof STALL_SLOTS)[number]));
  const row = Math.floor(slotIndex / 2);
  const col = slotIndex % 2;
  const cellX = xBase + 12 + col * 34;
  const cellY = 58 + row * 34;
  return {
    x: cellX + 14,
    y: cellY + 12,
  };
}

export function entranceMapPoint(currentBlock?: string | null): MapPoint {
  if (!currentBlock) return { x: 36, y: 248 };
  const block = currentBlock.replace(/-blok/i, "").trim().charAt(0).toUpperCase() || "A";
  const idx = blockIndex(block);
  return { x: 20 + idx * 98 + 41, y: 248 };
}

export function stallGraphNodeId(pin: Pick<IppodromPin, "block" | "stall" | "stallSlot">) {
  const slot = pin.stallSlot || normalizeStallSlot(pin.stall, pin.block);
  return `stall-${pin.block}-${slot}`;
}

export function pinsMatchStall(
  pin: Pick<IppodromPin, "block" | "stall" | "stallSlot">,
  stall: { block: string; code: string },
): boolean {
  if (pin.block.toUpperCase() !== stall.block.toUpperCase()) return false;
  const slot = pin.stallSlot || normalizeStallSlot(pin.stall, pin.block);
  return slot === stall.code || normalizeStallSlot(stall.code, stall.block) === slot;
}

export function buildRoutePath(from: MapPoint, to: MapPoint) {
  const midX = (from.x + to.x) / 2;
  const midY = Math.min(from.y, to.y) - 28;
  return `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`;
}

export function shopToMapMarker(shop: ShopSummary): MapShopMarker {
  const loc = parseMerchantLocation({
    ipadrom: shop.ipadrom,
    market_zone: shop.market_zone,
    block_sector: shop.block_sector,
    floor: shop.floor,
    section: shop.section ?? shop.shop_number,
    shop_number: shop.shop_number,
    location_label: shop.location_label,
  });
  const pin = parseShopLocation(shop);
  if (loc.blockLetter) pin.block = loc.blockLetter;
  if (loc.stallNumber !== "—") pin.stall = loc.stallNumber;
  pin.label = loc.addressLabel;
  if (loc.floorLevel) pin.floor = loc.floorLevel as 1 | 2;

  const point = stallMapPoint(pin);
  const { lat, lng } = indoorPixelToWgs84(point.x, point.y);
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    ipadrom: loc.market,
    floor: loc.floorLevel != null ? `${loc.floorLevel}-qavat` : shop.floor || `${pin.floor}-qavat`,
    pin,
    point,
    lat,
    lng,
    addressLabel: loc.addressLabel,
    locationComment: loc.locationComment,
    rowLabel: loc.row,
    shopNumber: loc.shopNumber,
    marketZone: loc.market,
    building: loc.building,
    blockSector: shop.block_sector ?? null,
    blockLetter: loc.blockLetter,
    aisle: loc.row,
    floorLevelLabel: loc.floorLevel != null ? `${loc.floorLevel}-qavat` : null,
  };
}

export function formatShopLocationBadge(shop: Pick<ShopSummary, "name" | "floor" | "ipadrom"> & LocationInput): string {
  const pin = parseShopLocation(shop);
  const market = (shop.ipadrom || "Ippodrom").replace(/\s+bozor(i)?$/i, "").trim() || "Ippodrom";
  return `Do'kon: ${shop.name} | ${market}, ${pin.block}-blok, rasta ${pin.stall}`;
}

export function uniqueShopMarkers(shops: ShopSummary[]): MapShopMarker[] {
  const seen = new Set<string>();
  const markers: MapShopMarker[] = [];
  for (const shop of shops) {
    if (!shop?.id || seen.has(shop.id)) continue;
    seen.add(shop.id);
    markers.push(shopToMapMarker(shop));
  }
  return markers;
}
