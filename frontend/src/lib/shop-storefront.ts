import { parseMerchantLocation } from "@/lib/map/merchant-location";
import type { ShopProfile } from "@/types";

export type ShopStorefrontMeta = {
  /** Qisqa manzil — bitta qator. */
  locationLine: string | null;
  /** Pastki chip lar (takrorlanmas). */
  chips: string[];
};

/** Do'kon vitrinasi uchun toza manzil va meta chip lar. */
export function getShopStorefrontMeta(shop: ShopProfile): ShopStorefrontMeta {
  const loc = parseMerchantLocation({
    ipadrom: shop.ipadrom_name || shop.ipadrom,
    floor: shop.floor,
    section: shop.section,
    location_label: shop.address_label,
  });

  const chips: string[] = [];
  const seen = new Set<string>();

  const push = (value: string | null | undefined) => {
    const text = (value ?? "").trim();
    if (!text || seen.has(text.toLowerCase())) return;
    seen.add(text.toLowerCase());
    chips.push(text);
  };

  if (loc.market) push(loc.market);
  if (loc.blockLetter) push(`${loc.blockLetter}-blok`);
  else if (loc.building) push(loc.building);
  if (loc.row) push(loc.row);
  if (loc.floorLevel) push(`${loc.floorLevel}-qavat`);
  if (loc.shopNumber && loc.shopNumber !== "—") {
    const num = loc.shopNumber.replace(/\s+/g, " ");
    if (!/do['']?kon/i.test(num)) push(`${num}-do'kon`);
    else push(num);
  }

  const addressLabel = shop.address_label?.trim();
  const locationLine =
    addressLabel ||
    (loc.addressLabel && loc.addressLabel !== loc.market ? loc.addressLabel : null) ||
    chips.join(" · ") ||
    null;

  const lineLower = (locationLine ?? "").toLowerCase();
  const lineParts = lineLower.split(/[·•,|]/).map((p) => p.trim()).filter(Boolean);

  const filteredChips = chips.filter((chip) => {
    const chipLower = chip.toLowerCase();
    if (lineLower.includes(chipLower)) return false;
    return !lineParts.some((part) => part.includes(chipLower) || chipLower.includes(part));
  });

  return { locationLine, chips: filteredChips };
}
