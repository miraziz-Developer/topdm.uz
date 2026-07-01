"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";

import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { AiVisualSearch } from "@/components/home/ai-visual-search";
import { BazaarCatalogToolbar } from "@/components/home/bazaar-catalog-toolbar";
import { DomainCategoryFilter } from "@/components/home/domain-category-filter";
import { HomeDealsRow } from "@/components/home/home-deals-row";
import { HomeExperienceLayout } from "@/components/home/home-experience-layout";
import { HomeRecommendedRow } from "@/components/home/home-recommended-row";
import { HomeSaleHero } from "@/components/home/home-sale-hero";
import { PremiumTrustAnchors } from "@/components/home/premium-trust-anchors";
import { PremiumBannersCarousel } from "@/components/home/premium-banners-carousel";
import { StoriesFeed } from "@/components/home/stories-feed";
import { PersonalizedHomeBanner } from "@/components/home/personalized-home-banner";
import { MerchantSpotlightRow } from "@/components/home/merchant-spotlight-row";
import { SiteFooter } from "@/components/brand/site-footer";
import { ReelsPreviewStrip } from "@/components/home/reels-preview-strip";
import { Navigation } from "@/components/Navigation";
import { ChinaProductPage } from "@/components/market/ChinaProductPage";
import { MasonryProductGrid } from "@/components/ui/masonry-product-grid";
import { useHomeExperience } from "@/hooks/useHomeExperience";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
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
import type { HomeDealFeed } from "@/lib/home-deal-sections";
import { filterProductsByCategory, type DomainCategoryId } from "@/lib/home-categories";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";
import type { Product } from "@/types";

export default function HomePage() {
  const t = useT();
  const [selected, setSelected] = useState<Product | null>(null);
  const [category, setCategory] = useState<DomainCategoryId>("all");
  const [bazaarFilters, setBazaarFilters] = useState<BazaarCatalogFilters>(DEFAULT_BAZAAR_FILTERS);
  const debouncedFilters = useDebouncedValue(bazaarFilters, 500);

  const applyCatalogHints = useCallback((patch: Partial<BazaarCatalogFilters>) => {
    setBazaarFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const experience = useHomeExperience({ bazaarFilters, onApplyCatalogHints: applyCatalogHints });

  const isChina = isChinaMarketEnabled() && bazaarFilters.catalogOrigin === "china";

  const searchParams = useMemo(() => filtersToSearchParams(debouncedFilters), [debouncedFilters]);
  const { data, isLoading: localLoading, isFetching, isError } = useProducts(searchParams, { enabled: !isChina });
  const featured = useFeaturedProducts();
  const dealFeed = useHomeDealFeed(16);
  const featuredShops = useFeaturedShops();

  const localFeed = data?.items?.length ? data.items : featured.data?.items ?? [];

  const filteredFeed = useMemo(() => {
    const byCategory = filterProductsByCategory(localFeed, category);
    return filterProductsClient(byCategory, debouncedFilters);
  }, [debouncedFilters, category, localFeed]);

  const displayFeed = useMemo(() => {
    if (filteredFeed.length > 0) return filteredFeed;
    if (category === "all" && bazaarFilters.marketZone === "all") {
      return localFeed.slice(0, 12);
    }
    return [];
  }, [filteredFeed, category, bazaarFilters.marketZone, localFeed]);

  const gridKey = `${filtersAnimationKey(debouncedFilters)}|${category}`;
  const catalogLoading = localLoading || isFetching;

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
            loading={catalogLoading && displayFeed.length === 0}
            onBand={setSelected}
            bulkMode={debouncedFilters.saleMode === "Optom"}
          />
        </motion.div>
      </AnimatePresence>
      {isError && !catalogLoading ? (
        <p className="mt-8 text-center text-sm text-red-600">
          Mahsulotlarni yuklab bo&apos;lmadi. Filtrlarni tekshirib qayta urinib ko&apos;ring.
        </p>
      ) : null}
      {displayFeed.length === 0 && !catalogLoading && !isError ? (
        <p className="mt-8 text-center text-sm text-gray-500">{t("home.discovery.noResults")}</p>
      ) : null}
    </section>
  );

  const dealSections: HomeDealFeed = dealFeed.data ?? {
    lightning: [],
    clearance: [],
    recommended: [],
  };

  return (
    <main className="min-h-dvh overflow-x-clip bg-canvas pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <Navigation />
      <div>
        <HomeExperienceLayout
          experience={experience}
          sections={{
            trust: isChina ? null : (
              <div className="mx-auto max-w-7xl px-4 pt-2 sm:px-6">
                <PremiumTrustAnchors />
              </div>
            ),
            sale_hero: isChina ? null : <HomeSaleHero />,
            banner: <PersonalizedHomeBanner experience={experience} />,
            lightning: isChina ? null : (
              <HomeDealsRow
                variant="lightning"
                products={dealSections.lightning}
                loading={dealFeed.isLoading}
              />
            ),
            clearance: isChina ? null : (
              <HomeDealsRow
                variant="clearance"
                products={dealSections.clearance}
                loading={dealFeed.isLoading}
              />
            ),
            reels: isChina ? null : <ReelsPreviewStrip />,
            visual_search: isChina ? null : <AiVisualSearch />,
            toolbar: filterBar,
            categories: categoryBar,
            recommended: isChina ? null : (
              <HomeRecommendedRow
                products={displayFeed}
                loading={catalogLoading && displayFeed.length === 0}
                category={category}
                onCategoryChange={setCategory}
              />
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


      <SiteFooter />
      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      <BottomNav />
    </main>
  );
}
