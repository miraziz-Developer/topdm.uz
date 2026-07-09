import { isUnreliableProductImage, PLACEHOLDER_IMAGE, resolveMediaUrl } from "@/lib/media";
export const SHOP_COVER_DEFAULT = "/brand/bozorliii-shop-cover-default.svg";

export function shopInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return `${words[0]![0] ?? ""}${words[1]![0] ?? ""}`.toUpperCase();
  }
  const compact = name.replace(/[^A-Za-zА-Яа-я0-9]/g, "");
  return (compact.slice(0, 2) || "BL").toUpperCase();
}

/** Eski seed, placeholder.svg, bo'sh — do'kon rasmi sifatida ishlatilmaydi. */
export function isUnreliableShopMedia(url?: string | null): boolean {
  const raw = (url ?? "").trim();
  if (!raw) return true;
  if (isUnreliableProductImage(raw)) return true;

  const lower = raw.toLowerCase();
  if (lower.includes("/placeholder.svg") || lower.endsWith("placeholder.svg")) return true;
  if (lower.includes("placeholder-boutique")) return true;
  if (lower.includes("bozorliii-product-placeholder")) return true;
  if (lower.includes("/placeholder") && !lower.includes("/api/v1/media/shops/")) return true;

  return false;
}

function firstReliableResolved(...sources: Array<string | null | undefined>): string | null {
  for (const raw of sources) {
    if (isUnreliableShopMedia(raw)) continue;
    const resolved = resolveMediaUrl(raw);
    if (!resolved || resolved === PLACEHOLDER_IMAGE) continue;
    if (isUnreliableShopMedia(resolved)) continue;
    return resolved;
  }
  return null;
}

export function resolveShopCoverUrl(
  shop: { storefront_image_url?: string | null; logo_url?: string | null },
  coverFromProduct?: string | null,
): string {
  return (
    firstReliableResolved(shop.storefront_image_url, shop.logo_url, coverFromProduct) ?? SHOP_COVER_DEFAULT
  );
}

export function resolveShopLogoUrl(
  shop: { logo_url?: string | null; storefront_image_url?: string | null },
  fallbackFromProduct?: string | null,
): string | null {
  return firstReliableResolved(shop.logo_url, shop.storefront_image_url, fallbackFromProduct);
}

export function hasCustomShopLogo(shop: { logo_url?: string | null }): boolean {
  return !isUnreliableShopMedia(shop.logo_url);
}

export function hasCustomShopCover(shop: {
  storefront_image_url?: string | null;
  logo_url?: string | null;
}): boolean {
  return !isUnreliableShopMedia(shop.storefront_image_url) || !isUnreliableShopMedia(shop.logo_url);
}
