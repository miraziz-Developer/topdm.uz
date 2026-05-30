"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { AiVisualSearch } from "@/components/home/ai-visual-search";
import { BazaarCatalogToolbar } from "@/components/home/bazaar-catalog-toolbar";
import { DomainCategoryFilter } from "@/components/home/domain-category-filter";
import { HomeExperienceLayout } from "@/components/home/home-experience-layout";
import { PremiumBannersCarousel } from "@/components/home/premium-banners-carousel";
import { StoriesFeed } from "@/components/home/stories-feed";
import { PersonalizedHomeBanner } from "@/components/home/personalized-home-banner";
import { MerchantSpotlightRow } from "@/components/home/merchant-spotlight-row";
import { SiteFooter } from "@/components/brand/site-footer";
import { ReelsPreviewStrip } from "@/components/home/reels-preview-strip";
import { Navigation } from "@/components/Navigation";
import { MasonryProductGrid } from "@/components/ui/masonry-product-grid";
import { useHomeExperience } from "@/hooks/useHomeExperience";
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

  const searchParams = useMemo(() => filtersToSearchParams(bazaarFilters), [bazaarFilters]);
  const { data, isLoading } = useProducts(searchParams);
  const featured = useFeaturedProducts();
  const featuredShops = useFeaturedShops();

  const feed = data?.items?.length ? data.items : featured.data?.items ?? [];

  const filteredFeed = useMemo(() => {
    const byCategory = filterProductsByCategory(feed, category);
    return filterProductsClient(byCategory, bazaarFilters);
  }, [bazaarFilters, category, feed]);

  const displayFeed =
    filteredFeed.length > 0 || (category === "all" && bazaarFilters.marketZone === "all")
      ? filteredFeed
      : feed.slice(0, 12);

  const gridKey = `${filtersAnimationKey(bazaarFilters)}|${category}`;

  /* ── Filter bar: sticky below header ── */
  const filterBar = (
    <div className="sticky top-14 z-40 border-b border-border-subtle bg-white/98 shadow-sm backdrop-blur-md sm:top-16">
      <BazaarCatalogToolbar
        filters={bazaarFilters}
        onChange={setBazaarFilters}
      />
    </div>
  );

  /* ── Category chips: scrollable ── */
  const categoryBar = (
    <div className="bg-white pb-1 pt-0.5">
      <DomainCategoryFilter value={category} onChange={setCategory} />
    </div>
  );

  /* ── Product grid — no redundant header ── */
  const catalogSection = (
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
            loading={isLoading || featured.isLoading}
            onBand={setSelected}
            bulkMode={bazaarFilters.saleMode === "Optom"}
          />
        </motion.div>
      </AnimatePresence>
      {displayFeed.length === 0 && !isLoading ? (
        <p className="mt-8 text-center text-sm text-gray-500">{t("home.discovery.noResults")}</p>
      ) : null}
    </section>
  );

  return (
    <main className="min-h-dvh overflow-x-clip bg-canvas pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0">
      <Navigation />

      <HomeExperienceLayout
        experience={experience}
        sections={{
          banner: <PersonalizedHomeBanner experience={experience} />,
          reels: <ReelsPreviewStrip />,
          visual_search: <AiVisualSearch />,
          toolbar: filterBar,
          categories: categoryBar,
          banners: <PremiumBannersCarousel />,
          stories: <StoriesFeed />,
          spotlight: (
            <MerchantSpotlightRow
              shops={featuredShops.data?.items ?? []}
              products={displayFeed}
              loading={featuredShops.isLoading}
            />
          ),
          products: catalogSection,
        }}
      />

      <SiteFooter />
      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      {experience?.show_chat !== false ? <AIChat /> : null}
      <BottomNav />
    </main>
  );
}
