import type { PremiumBannerSlide } from "@/types/premium-banner";
import type { LiveStory, StoryDockRing } from "@/types";

const PLATFORM_SHOP_PREFIX = "platform-ad:";

export function isPlatformAdRing(ring: StoryDockRing): boolean {
  return Boolean(ring.is_platform_ad) || ring.shop_id.startsWith(PLATFORM_SHOP_PREFIX);
}

export function bannerSlideToStoryRing(slide: PremiumBannerSlide): StoryDockRing {
  const shopId = `${PLATFORM_SHOP_PREFIX}${slide.id}`;
  const location = [slide.ipadrom, slide.location_label].filter(Boolean).join(", ") || "Bozorliii.uz";
  const story: LiveStory = {
    id: `platform-story-${slide.id}`,
    shop_id: shopId,
    image_url: slide.image_url,
    level_context: slide.headline || location,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    is_hot: slide.tariff_code === "gold",
    route_path: slide.cta_url || "/search",
    shop: {
      id: shopId,
      name: slide.shop_name || "Bozorliii",
      ipadrom: slide.ipadrom || "Bozorliii.uz",
      floor: slide.location_label || "Reklama",
      location_label: location,
      slug: slide.shop_slug,
      is_featured: true,
    },
  };

  return {
    shop_id: shopId,
    shop: story.shop,
    preview_story: story,
    active_count: 1,
    is_platform_ad: true,
  };
}

export function bannerSlidesToStoryRings(slides: PremiumBannerSlide[], limit = 5): StoryDockRing[] {
  return slides.slice(0, limit).map(bannerSlideToStoryRing);
}
