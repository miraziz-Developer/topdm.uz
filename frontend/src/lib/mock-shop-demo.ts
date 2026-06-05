import type { LiveStory, Product, ShopProfile, ShopSummary } from "@/types";

/** Moda vitrina uchun barqaror Unsplash preview (CDN). */
const DEMO_IMAGES = [
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1434389677669-641f78720c3e?auto=format&fit=crop&w=800&h=800&q=80",
] as const;

const DEMO_PRODUCT_NAMES = [
  "Atlas ko'ylak — premium",
  "Yozgi libos to'plami",
  "Klassik palto",
  "Turk stil ko'ylak",
  "Rangli sharf to'plami",
  "Kechki libos",
] as const;

const DEMO_PRICES_UZS = [189_000, 245_000, 520_000, 156_000, 78_000, 310_000] as const;

function shopSummaryFromProfile(shop: ShopProfile): ShopSummary {
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    ipadrom: shop.ipadrom_name || shop.ipadrom || "Ippodrom",
    floor: shop.floor || "1-qavat",
    section: shop.section || undefined,
    is_verified: shop.is_verified,
    is_featured: shop.is_featured,
    rating: shop.rating,
    review_count: shop.review_count,
  };
}

/** Do'kon sahifasi — 3 ta demo story (24h formatiga o'xshash). */
export function buildMockShopStories(
  shop: Pick<ShopProfile, "id" | "name" | "slug"> & {
    ipadrom?: string | null;
    ipadrom_name?: string | null;
    floor?: string | null;
  },
): LiveStory[] {
  const summary = shopSummaryFromProfile(shop as ShopProfile);
  const market = summary.ipadrom || "Ippodrom";
  const contexts = [
    `${market} · yangi tushganlar`,
    "Chegirma va aksiya",
    "Premium kolleksiya",
  ];

  return DEMO_IMAGES.map((image_url, index) => ({
    id: `demo-story-${shop.id}-${index}`,
    shop_id: shop.id,
    image_url,
    level_context: contexts[index] ?? contexts[0]!,
    created_at: new Date(Date.now() - index * 3_600_000).toISOString(),
    expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    is_hot: index === 0,
    route_path: `/map?shop=${encodeURIComponent(shop.slug)}`,
    shop: summary,
  }));
}

/** Do'kon sahifasi — demo katalog (mahsulot sahifasiga o'tmaydi). */
export function buildMockShopProducts(shop: ShopProfile): Product[] {
  const summary = shopSummaryFromProfile(shop);

  return DEMO_PRODUCT_NAMES.map((name, index) => ({
    id: `demo-product-${shop.id}-${index}`,
    name,
    price: DEMO_PRICES_UZS[index] ?? 199_000,
    price_uzs: DEMO_PRICES_UZS[index] ?? 199_000,
    currency: "UZS",
    sale_type: "Chakana" as const,
    images: [DEMO_IMAGES[index % DEMO_IMAGES.length]!],
    is_available: true,
    stock_count: 12 - index,
    is_featured: index < 2,
    attributes: { demo: true },
    shop: summary,
  }));
}

export function isDemoProduct(product: Product): boolean {
  return Boolean(product.attributes && (product.attributes as { demo?: boolean }).demo);
}
