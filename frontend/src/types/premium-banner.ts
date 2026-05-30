export type PremiumTariffCode = "bronze" | "silver" | "gold";

export type PremiumBannerSlide = {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_slug: string;
  rating: number;
  image_url: string;
  headline: string;
  tariff_code: PremiumTariffCode;
  tariff_label: string;
  priority_weight: number;
  dwell_ms: number;
  frame_style: string;
  badge_label: string | null;
  cta_url: string;
  ipadrom?: string | null;
  location_label?: string | null;
  rotation_key?: string;
};

export type CarouselPublicConfig = {
  enabled: boolean;
  crossfade: boolean;
  autoplay: boolean;
  interval_ms: number;
};

export type PremiumBannersResponse = {
  source: "sponsored" | "fallback" | "empty" | "disabled";
  rotation_interval_ms: number;
  carousel_version?: number;
  carousel?: CarouselPublicConfig;
  items: PremiumBannerSlide[];
  slides: PremiumBannerSlide[];
};
