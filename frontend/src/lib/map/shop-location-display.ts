import { parseMerchantLocation } from "@/lib/map/merchant-location";
import type { MapShopMarker } from "@/lib/shop-location";
import type { ShopSummary } from "@/types";

export type ShopLocationDetails = {
  market: string;
  /** Bino / sektor: Chorsu bloki, 3-Blok, Yevropa bloki */
  building: string | null;
  /** A–D harf bloki (agar bo‘lsa) */
  block: string | null;
  /** Qator / yo‘lak: 5-yo'lak, Toshkent yo'lagi */
  row: string | null;
  /** Qavat (faqat raqamli) */
  floor: string | null;
  stallNumber: string;
  comment: string | null;
  summary: string;
};

function cleanComment(text: string | null | undefined, addressLabel: string): string | null {
  if (!text?.trim()) return null;
  const t = text.trim();
  if (t === addressLabel) return null;
  if (/^\d+-qavat\s*•/i.test(t)) return null;
  return t;
}

function markerToMerchantInput(marker: MapShopMarker) {
  return {
    ipadrom: marker.ipadrom,
    market_zone: marker.marketZone,
    block_sector: marker.building ?? marker.blockSector,
    floor: marker.aisle ?? marker.floor,
    section: marker.shopNumber,
    location_comment: marker.locationComment,
    location_label: marker.addressLabel,
  };
}

export function locationDetailsFromMarker(marker: MapShopMarker): ShopLocationDetails {
  const parsed = parseMerchantLocation(markerToMerchantInput(marker));

  const block =
    marker.blockLetter?.trim() ||
    parsed.blockLetter ||
    (marker.pin.block && /^[A-D]$/i.test(marker.pin.block) ? marker.pin.block.toUpperCase() : null);

  const building = marker.building?.trim() || parsed.building;
  const row = marker.rowLabel?.trim() || parsed.row;
  const floor =
    marker.floorLevelLabel?.trim() ||
    (parsed.floorLevel != null ? `${parsed.floorLevel}-qavat` : null);
  const stallNumber =
    extractShopNumberFromText(marker.shopNumber) ||
    extractShopNumberFromText(marker.pin.stall) ||
    parsed.stallNumber;

  const comment = cleanComment(marker.locationComment, parsed.addressLabel);

  const parts = [parsed.market];
  if (building) parts.push(building);
  else if (block) parts.push(`${block}-blok`);
  if (row) parts.push(row);
  if (floor) parts.push(floor);
  parts.push(`${stallNumber}-do'kon`);

  return {
    market: parsed.market,
    building,
    block,
    row,
    floor,
    stallNumber,
    comment,
    summary: parts.join(" • "),
  };
}

function extractShopNumberFromText(text: string | null | undefined): string {
  if (!text?.trim()) return "—";
  const m = text.match(/(\d{1,4})/);
  return m?.[1] ?? text.trim();
}

export function locationDetailsFromShop(shop: ShopSummary): ShopLocationDetails {
  const parsed = parseMerchantLocation({
    ipadrom: shop.ipadrom,
    market_zone: shop.market_zone,
    block_sector: shop.block_sector,
    floor: shop.floor,
    section: shop.section ?? shop.shop_number,
    shop_number: shop.shop_number,
    location_label: shop.location_label,
  });

  return {
    market: parsed.market,
    building: parsed.building,
    block: parsed.blockLetter,
    row: parsed.row,
    floor: parsed.floorLevel != null ? `${parsed.floorLevel}-qavat` : null,
    stallNumber: extractShopNumberFromText(parsed.shopNumber),
    comment: cleanComment(shop.location_label, parsed.addressLabel),
    summary: parsed.addressLabel,
  };
}
