"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { AiVisualSearch } from "@/components/home/ai-visual-search";
import { BazaarCatalogToolbar } from "@/components/home/bazaar-catalog-toolbar";
import { DomainCategoryFilter } from "@/components/home/domain-category-filter";
import { HomeDealsRow } from "@/components/home/home-deals-row";
import { HomeExperienceLayout } from "@/components/home/home-experience-layout";
import { HomeRecommendedRow } from "@/components/home/home-recommended-row";
import { HomeSaleHero } from "@/components/home/home-sale-hero";
import { HomeTrustStrip } from "@/components/home/home-trust-strip";
import { PremiumBannersCarousel } from "@/components/home/premium-banners-carousel";
import { StoriesFeed } from "@/components/home/stories-feed";
import { PersonalizedHomeBanner } from "@/components/home/personalized-home-banner";
import { MerchantSpotlightRow } from "@/components/home/merchant-spotlight-row";
import { SiteFooter } from "@/components/brand/site-footer";
import { ReelsPreviewStrip } from "@/components/home/reels-preview-strip";
import { StickyMiniCart } from "@/components/home/sticky-mini-cart";
import { Navigation } from "@/components/Navigation";
import { ChinaProductPage } from "@/components/market/ChinaProductPage";
import { MasonryProductGrid } from "@/components/ui/masonry-product-grid";
import { useHomeExperience } from "@/hooks/useHomeExperience";
import { useHomeDealFeed } from "@/hooks/useDealProducts";
import { useFeaturedProducts } from "@/hooks/useFeaturedProducts";
import { useFeaturedShops } from "@/hooks/useFeaturedShops";
import { useProducts } from "@/hooks/useProducts";
import {
  DEFAULT_BAZAAR_FILTERS,
  filterProductsClient,
  filtersAnimationKey,
  filtersToSearchParams,
  type BazaarCatalogFilters,
} from "@/lib/home-catalog-filters";
import { useT } from "@/i18n/locale-provider";
import { filterProductsByCategory, type DomainCategoryId } from "@/lib/home-categories";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";
import type { Product } from "@/types";

export default function HomePage() {
  const t = useT();
  const [selected, setSelected] = useState<Product | null>(null);
  const [category, setCategory] = useState<DomainCategoryId>("all");
  const [bazaarFilters, setBazaarFilters] = useState<BazaarCatalogFilters>(DEFAULT_BAZAAR_FILTERS);

  const applyCatalogHints = useCallback((patch: Partial<BazaarCatalogFilters>) => {
    setBazaarFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const experience = useHomeExperience({ bazaarFilters, onApplyCatalogHints: applyCatalogHints });

  const isChina = isChinaMarketEnabled() && bazaarFilters.catalogOrigin === "china";

  const searchParams = useMemo(() => filtersToSearchParams(bazaarFilters), [bazaarFilters]);
  const { data, isLoading: localLoading } = useProducts(searchParams, { enabled: !isChina });
  const featured = useFeaturedProducts();
  const dealFeed = useHomeDealFeed(16);
  const featuredShops = useFeaturedShops();

  const localFeed = data?.items?.length ? data.items : featured.data?.items ?? [];

  const filteredFeed = useMemo(() => {
    const byCategory = filterProductsByCategory(localFeed, category);
    return filterProductsClient(byCategory, bazaarFilters);
  }, [bazaarFilters, category, localFeed]);

  const displayFeed =
    filteredFeed.length > 0 || (category === "all" && bazaarFilters.marketZone === "all")
      ? filteredFeed
      : localFeed.slice(0, 12);

  const gridKey = `${filtersAnimationKey(bazaarFilters)}|${category}`;

  const filterBar = (
    <div className="sticky top-14 z-40 border-b border-border-subtle bg-white/98 shadow-sm backdrop-blur-md sm:top-16">
      <BazaarCatalogToolbar filters={bazaarFilters} onChange={setBazaarFilters} />
    </div>
  );

  const categoryBar = !isChina ? (
    <div className="sticky top-14 z-30 border-b border-border-subtle/80 bg-white/95 pb-1 pt-0.5 backdrop-blur-md sm:top-16">
      <DomainCategoryFilter value={category} onChange={setCategory} />
    </div>
  ) : null;

  const catalogSection = isChina ? (
    <section id="catalog" className="bg-canvas pb-12 pt-2">
      <ChinaProductPage compact />
    </section>
  ) : (
    <section id="catalog" className="mx-auto max-w-7xl px-4 pb-12 pt-3 sm:px-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={gridKey}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <MasonryProductGrid
            products={displayFeed}
            loading={localLoading || featured.isLoading}
            onBand={setSelected}
            bulkMode={bazaarFilters.saleMode === "Optom"}
          />
        </motion.div>
      </AnimatePresence>
      {displayFeed.length === 0 && !localLoading ? (
        <p className="mt-8 text-center text-sm text-gray-500">{t("home.discovery.noResults")}</p>
      ) : null}
    </section>
  );

  const recommendedPool = useMemo(() => {
    const merged = [
      ...(dealFeed.data?.recommended ?? []),
      ...(dealFeed.data?.lightning ?? []),
      ...displayFeed,
    ];
    const seen = new Set<string>();
    return merged.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [dealFeed.data, displayFeed]);

  return (
    <main className="min-h-dvh overflow-x-clip bg-canvas pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <Navigation />
      {!isChina ? <HomeTrustStrip /> : null}

      <div>
        <HomeExperienceLayout
          experience={experience}
          sections={{
            trust: null,
            sale_hero: isChina ? null : <HomeSaleHero />,
            banner: <PersonalizedHomeBanner experience={experience} />,
            lightning: isChina ? null : (
              <HomeDealsRow
                variant="lightning"
                products={dealFeed.data?.lightning ?? []}
                loading={dealFeed.isLoading}
              />
            ),
            clearance: isChina ? null : (
              <HomeDealsRow
                variant="clearance"
                products={dealFeed.data?.clearance ?? []}
                loading={dealFeed.isLoading}
              />
            ),
            reels: isChina ? null : <ReelsPreviewStrip />,
            visual_search: isChina ? null : <AiVisualSearch />,
            toolbar: filterBar,
            categories: categoryBar,
            recommended: isChina ? null : (
              <HomeRecommendedRow products={recommendedPool} loading={dealFeed.isLoading || localLoading} />
            ),
            banners: isChina ? null : <PremiumBannersCarousel />,
            stories: isChina ? null : <StoriesFeed />,
            spotlight: isChina ? null : (
              <MerchantSpotlightRow
                shops={featuredShops.data?.items ?? []}
                products={displayFeed}
                loading={featuredShops.isLoading}
              />
            ),
            products: catalogSection,
          }}
        />
      </div>

      {!isChina ? <StickyMiniCart /> : null}

      <SiteFooter />
      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      {experience?.show_chat !== false ? <AIChat /> : null}
      <BottomNav />
    </main>
  );
}
