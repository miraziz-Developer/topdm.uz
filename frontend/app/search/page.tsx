"use client";

import { motion } from "framer-motion";
import { Grid3X3, List, SlidersHorizontal } from "lucide-react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductCard } from "@/components/ProductCard";
import { DiscoveryProductGrid } from "@/components/ui/discovery-product-grid";
import { SearchEmptyState } from "@/components/ui/search-empty-state";
import { SmartFilters, applySmartFilters, type SmartFilterState } from "@/components/ui/smart-filters";
import { ZeroClickInsights } from "@/components/ui/zero-click-insights";
import { BandQilishModal } from "@/components/BandQilishModal";
import { usePhotoSearchUiStore } from "@/stores/photo-search-ui-store";
import { useLookSearch } from "@/hooks/useLookSearch";
import { useFeaturedProducts } from "@/hooks/useFeaturedProducts";
import { useProducts } from "@/hooks/useProducts";
import { isLookSearchQuery } from "@/lib/look-query";
import { buildSearchQueryFromDeeplink, parseSearchUrlParams } from "@/lib/search-deeplink";
import { PhotoDetectedRail } from "@/components/search/photo-detected-rail";
import { useVisualCategorySearch } from "@/components/search/visual-search";
import type { NormalizedBbox } from "@/lib/bbox-layout";
import { cropImageFromBbox } from "@/lib/crop-image";
import { detectedColorToFilterLabel } from "@/lib/visual-search-color";
import {
  getDetectedItems,
  shouldShowPhotoSegmentPicker,
  pickDefaultDetectedId,
  patchDetectedBlockProducts,
  PHOTO_SEARCH_UPDATED_EVENT,
  productsForDetected,
  readStoredPhotoSearch,
  storePhotoSearch,
  type PhotoSearchPayload,
} from "@/lib/photoSearch";
import { sortProducts } from "@/lib/sort-products";
import { useLocationStore } from "@/stores/location-store";
import type { Product } from "@/types";

const sortOptions = [
  { value: "relevance", label: "Eng mos" },
  { value: "price_asc", label: "Arzonroq" },
  { value: "price_desc", label: "Qimmatroq" },
  { value: "newest", label: "Yangi" },
  { value: "popular", label: "Ko'p ko'rilgan" },
];

function SearchPageFallback() {
  return (
    <main className="page-shell min-h-dvh bg-canvas">
      <Navigation />
      <motion.div className="pt-14 sm:pt-16 relative z-10 mx-auto max-w-6xl px-4 sm:px-5">
        <motion.div className="skeleton mb-6 h-10 w-48 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      </motion.div>
      <BottomNav />
    </main>
  );
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appliedQuery = searchParams.get("q")?.trim() ?? "";
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [photoSearch, setPhotoSearch] = useState<PhotoSearchPayload | null>(null);
  const [selectedDetectedId, setSelectedDetectedId] = useState<string | null>(null);
  const refiningBlockRef = useRef<string | null>(null);
  const refinedBlocksRef = useRef<Set<string>>(new Set());
  const lastPreviewRef = useRef<string | null>(null);
  const [filters, setFilters] = useState<SmartFilterState>({ colors: [], materials: [], blocks: [] });
  const currentBlock = useLocationStore((state) => state.currentBlock);
  const featured = useFeaturedProducts();

  const photoQuery = searchParams.get("photo") === "1";
  const isPhotoMode = photoQuery || Boolean(photoSearch);
  const detectedBlocks = getDetectedItems(photoSearch);
  const hasQuery = Boolean(appliedQuery);
  const isLookMode = !isPhotoMode && hasQuery && isLookSearchQuery(appliedQuery);
  const urlBudgetMax = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    return parseSearchUrlParams(window.location.search).maxPrice;
  }, [appliedQuery]);

  const data = useProducts(
    {
      q: appliedQuery,
      page: 1,
      limit: 24,
      max_price: filters.maxPrice ?? urlBudgetMax,
    },
    { enabled: !isPhotoMode && !isLookMode && hasQuery },
  );
  const lookSearch = useLookSearch(appliedQuery, isLookMode);

  const photoSearchError = usePhotoSearchUiStore((s) => s.error);
  const isPhotoLoading = usePhotoSearchUiStore((s) => s.isSearching);
  const { handleCategorySearch, loading: isCategoryRefining, error: categoryRefineError } =
    useVisualCategorySearch();

  const photoProducts = productsForDetected(photoSearch, selectedDetectedId);
  const photoStylistText = useMemo(() => {
    if (!photoSearch) return "";
    const outfitChips = detectedBlocks.length >= 2;
    if (outfitChips || photoSearch.mode === "outfit_multi_fast") {
      const block = selectedDetectedId
        ? detectedBlocks.find((b) => b.id === selectedDetectedId)
        : detectedBlocks[0];
      if (block?.products?.length) {
        const topPct = block.products[0]?.visual_match_pct;
        return topPct
          ? `${block.products.length} ta vizual mos rasm (eng yuqori ${topPct}%)`
          : `${block.products.length} ta vizual mos rasm`;
      }
      return photoSearch.assistant_text?.trim() ?? "";
    }
    const block = selectedDetectedId
      ? detectedBlocks.find((b) => b.id === selectedDetectedId)
      : detectedBlocks[0];
    if (block?.products?.length) {
      const topPct = block.products[0]?.visual_match_pct;
      return topPct
        ? `${block.products.length} ta vizual mos rasm (eng yuqori ${topPct}%)`
        : `${block.products.length} ta vizual mos rasm`;
    }
    const flat = photoSearch.items ?? [];
    const trustedFlat = flat.filter((p) => (p.visual_match_pct ?? 0) >= 35);
    if (trustedFlat.length) {
      const topPct = trustedFlat[0]?.visual_match_pct;
      return topPct
        ? `${trustedFlat.length} ta vizual mos rasm (eng yuqori ${topPct}%)`
        : `${trustedFlat.length} ta vizual mos rasm`;
    }
    return photoSearch.assistant_text?.trim() ?? "";
  }, [photoSearch, selectedDetectedId, detectedBlocks]);
  const lookStylistText = lookSearch.data?.assistant_text?.trim() ?? "";
  const stylistNarrative = isPhotoMode ? photoStylistText : isLookMode ? lookStylistText : "";
  const resultItems = isPhotoMode
    ? photoProducts.items.filter((p) => p.visual_match !== false)
    : isLookMode
      ? lookSearch.data?.items ?? []
      : hasQuery
        ? data.data?.items ?? []
        : featured.data?.items ?? [];
  const filteredItems = useMemo(
    () =>
      sortProducts(
        applySmartFilters(resultItems, filters, filters.nearbyBlockOnly ? currentBlock : null, {
          skipColorFilter: isPhotoMode,
        }),
        sortBy as "relevance" | "price_asc" | "price_desc" | "newest" | "popular",
      ),
    [currentBlock, filters, isPhotoMode, resultItems, sortBy],
  );
  const resultTotal = isPhotoMode
    ? photoProducts.items.length
    : isLookMode
      ? lookSearch.data?.total ?? lookSearch.data?.items?.length ?? 0
      : hasQuery
        ? data.data?.total ?? 0
        : featured.data?.items?.length ?? 0;
  const resultsLoading = isPhotoMode
    ? isCategoryRefining
    : isLookMode
      ? lookSearch.isLoading
      : hasQuery
        ? data.isLoading
        : featured.isLoading;
  const resultsError = isPhotoMode
    ? Boolean(photoSearchError)
    : isLookMode
      ? lookSearch.isError
      : hasQuery
        ? data.isError
        : featured.isError;
  const trendSuggestions = featured.data?.items ?? [];
  const hasActiveResults =
    filteredItems.length > 0 || Boolean((isPhotoMode || isLookMode) && stylistNarrative);
  const showZeroResults = !resultsLoading && !resultsError && !hasActiveResults;
  const showTrendFallback = showZeroResults && !photoQuery && trendSuggestions.length > 0;
  const showPhotoSegmentPicker = isPhotoMode && shouldShowPhotoSegmentPicker(photoSearch);
  const photoSlotEmpty =
    isPhotoMode && Boolean(selectedDetectedId) && photoProducts.items.length === 0 && !isPhotoLoading && !isCategoryRefining;

  const applyDetectedColorFilter = (_block: { color?: string } | undefined) => {
    // Rang chip faqat ko'rsatish — rasm qidiruvda nom bo'yicha rang filtri olib tashlamaydi
  };

  useEffect(() => {
    const syncPhoto = () => {
      if (searchParams.get("photo") !== "1") return;
      const stored = readStoredPhotoSearch();
      if (stored) {
        setPhotoSearch(stored);
        const blocks = getDetectedItems(stored);
        setSelectedDetectedId((prev) => {
          if (prev && blocks.some((b) => b.id === prev)) return prev;
          return pickDefaultDetectedId(stored);
        });
      }
    };

    syncPhoto();
    window.addEventListener(PHOTO_SEARCH_UPDATED_EVENT, syncPhoto);
    return () => window.removeEventListener(PHOTO_SEARCH_UPDATED_EVENT, syncPhoto);
  }, [searchParams, isPhotoLoading]);

  useEffect(() => {
    const deeplink = parseSearchUrlParams(searchParams.toString());
    if (deeplink.maxPrice || deeplink.style || deeplink.categories.length) {
      setFilters((prev) => ({
        ...prev,
        maxPrice: deeplink.maxPrice ?? prev.maxPrice,
      }));
      setShowFilters(true);
    }

    if (searchParams.get("photo") !== "1") {
      setPhotoSearch(null);
    }
  }, [searchParams]);

  const refineDetectedBlock = useCallback(
    async (id: string, force = false) => {
      if (!force && refinedBlocksRef.current.has(id)) return;
      if (refiningBlockRef.current === id) return;

      const stored = readStoredPhotoSearch();
      const previewUrl = stored?.previewUrl ?? photoSearch?.previewUrl;
      if (!previewUrl) return;
      const block = getDetectedItems(stored ?? photoSearch).find((b) => b.id === id);
      if (!block?.bbox) return;

      refiningBlockRef.current = id;
      try {
        let cropBase64 = block.refine_crop_url ?? block.thumbnail_url ?? null;
        if (previewUrl && block.bbox) {
          try {
            cropBase64 = await cropImageFromBbox(previewUrl, block.bbox, 720);
          } catch {
            // Server crop yoki thumbnail zaxirasi
          }
        }
        if (!cropBase64) return;

        const products = await handleCategorySearch(
          { ...block, crop_base64: cropBase64 },
          {
            minPrice: filters.minPrice ?? null,
            maxPrice: filters.maxPrice ?? null,
          },
        );
        if (!products.length) return;

        refinedBlocksRef.current.add(id);
        setPhotoSearch((prev) => {
          if (!prev) return prev;
          const next = patchDetectedBlockProducts(prev, id, products);
          storePhotoSearch(next);
          return next;
        });
      } finally {
        refiningBlockRef.current = null;
      }
    },
    [filters.maxPrice, filters.minPrice, handleCategorySearch, photoSearch],
  );

  const handleDetectedSelect = async (id: string) => {
    setSelectedDetectedId(id);
    const block = detectedBlocks.find((b) => b.id === id);
    if (block) applyDetectedColorFilter(block);
    refinedBlocksRef.current.delete(id);
    await refineDetectedBlock(id, true);
  };

  const handleManualRegion = useCallback(
    async (bbox: NormalizedBbox) => {
      const previewUrl = photoSearch?.previewUrl ?? readStoredPhotoSearch()?.previewUrl;
      if (!previewUrl) return;

      const manualId = "manual";
      try {
        const cropBase64 = await cropImageFromBbox(previewUrl, bbox, 720);
        const products = await handleCategorySearch(
          {
            label_uz: "visual",
            search_query: "",
            thumbnail_url: cropBase64,
            refine_crop_url: cropBase64,
            crop_base64: cropBase64,
          },
          {
            minPrice: filters.minPrice ?? null,
            maxPrice: filters.maxPrice ?? null,
          },
        );

        setSelectedDetectedId(manualId);
        setPhotoSearch((prev) => {
          if (!prev) return prev;
          const rest = (prev.detected_items ?? []).filter((b) => b.id !== manualId);
          const manualBlock = {
            id: manualId,
            label_uz: "visual",
            search_query: "",
            bbox,
            thumbnail_url: cropBase64,
            refine_crop_url: cropBase64,
            products,
            total: products.length,
          };
          const next = { ...prev, detected_items: [...rest, manualBlock] };
          storePhotoSearch(next);
          return next;
        });
        refinedBlocksRef.current.add(manualId);
      } catch {
        // crop yoki API xatosi — jim o'tkazamiz
      }
    },
    [filters.maxPrice, filters.minPrice, handleCategorySearch, photoSearch?.previewUrl],
  );

  useEffect(() => {
    const preview = photoSearch?.previewUrl ?? null;
    if (preview !== lastPreviewRef.current) {
      lastPreviewRef.current = preview;
      refinedBlocksRef.current.clear();
    }
  }, [photoSearch?.previewUrl]);

  useEffect(() => {
    if (!isPhotoMode || !photoSearch?.previewUrl || !selectedDetectedId || isPhotoLoading) return;
    void refineDetectedBlock(selectedDetectedId);
  }, [isPhotoMode, isPhotoLoading, photoSearch?.previewUrl, refineDetectedBlock, selectedDetectedId]);

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />

      <div className="pt-14 sm:pt-16 relative z-10 mx-auto max-w-6xl px-4 sm:px-5">
        {photoSearchError || categoryRefineError ? (
          <p className="mb-4 text-sm text-red">{photoSearchError || categoryRefineError}</p>
        ) : null}

        {hasActiveResults && !isPhotoMode ? (
          <ZeroClickInsights items={filteredItems} />
        ) : showTrendFallback && !isPhotoMode ? (
          <ZeroClickInsights items={[]} trendFallback={trendSuggestions} />
        ) : null}

        {(isPhotoMode || isLookMode) && stylistNarrative ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="mb-4 rounded-2xl border border-electric-500/20 bg-electric-500/5 px-4 py-3 text-sm leading-relaxed text-ink-700 whitespace-pre-wrap"
          >
            {stylistNarrative}
          </motion.div>
        ) : null}

        {showPhotoSegmentPicker && photoSearch ? (
          <PhotoDetectedRail
            previewUrl={photoSearch.previewUrl}
            items={detectedBlocks}
            selectedId={selectedDetectedId}
            onSelect={handleDetectedSelect}
            onManualSelect={handleManualRegion}
          />
        ) : isPhotoMode && photoSearch ? (
          <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-border-subtle bg-surface p-4 md:flex-row md:items-center">
            <div className="relative h-28 w-28 overflow-hidden rounded-xl bg-elevated">
              <Image
                src={photoSearch.previewUrl}
                alt="Yuklangan rasm"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm text-text-400">Rasm bo'yicha qidiruv</p>
              <p className="text-lg font-semibold text-text-100">Rasm bo&apos;yicha qidiruv</p>
            </div>
          </div>
        ) : isPhotoMode && photoSearch?.previewUrl && isPhotoLoading ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex flex-col items-center gap-4 rounded-2xl border border-border-subtle bg-surface p-6"
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.4 }}
              className="relative h-40 w-32 overflow-hidden rounded-2xl bg-elevated"
            >
              <Image src={photoSearch.previewUrl} alt="Tahlil" fill unoptimized className="object-cover" />
            </motion.div>
            <p className="text-sm text-text-400">AI rasmni tahlil qilmoqda — chip va natijalar tayyorlanadi…</p>
          </motion.div>
        ) : null}
        {hasActiveResults && !isPhotoMode && (showFilters || appliedQuery) ? (
          <div className="relative z-0 mb-6">
            <SmartFilters value={filters} onChange={setFilters} products={resultItems} />
          </div>
        ) : null}

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isPhotoMode ? (
              <p className="text-sm text-text-300">
                {isPhotoLoading ? (
                  "Rasm tahlil qilinmoqda…"
                ) : (
                  <>
                    <span className="font-semibold text-text-100">{filteredItems.length}</span> natija
                    : rasm bo&apos;yicha
                  </>
                )}
              </p>
            ) : isLookMode ? (
              <p className="text-sm text-text-300">
                <span className="font-semibold text-text-100">{filteredItems.length}</span> look elementi
                {filteredItems.length !== resultTotal ? ` / ${resultTotal}` : ""}: &quot;{appliedQuery}&quot;
              </p>
            ) : hasQuery ? (
              <p className="text-sm text-text-300">
                <span className="font-semibold text-text-100">{filteredItems.length}</span> natija
                {filteredItems.length !== resultTotal ? ` / ${resultTotal}` : ""}: &quot;{appliedQuery}&quot;
              </p>
            ) : (
              <p className="text-sm text-text-300">
                <span className="font-semibold text-text-100">{resultTotal}</span> ta trend tovar
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-300 transition-colors hover:border-gold-500/30 hover:text-text-100 md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtr
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-300 focus:outline-none focus:border-gold-500/50"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="hidden items-center rounded-lg border border-border-subtle md:flex">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-surface text-gold-500" : "text-text-400 hover:text-text-100"}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-surface text-gold-500" : "text-text-400 hover:text-text-100"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {resultsLoading || isPhotoLoading ? (
          <DiscoveryProductGrid products={[]} loading onBand={setSelected} />
        ) : resultsError ? (
          <div className="rounded-2xl border border-red/20 bg-red/10 p-6 text-center text-sm text-red">
            {isPhotoMode && photoSearchError ? photoSearchError : "Qidiruvda xatolik bo'ldi. Qayta urinib ko'ring."}
          </div>
        ) : photoSlotEmpty ? (
          <div className="rounded-3xl border border-border-subtle bg-surface p-8 text-center">
            <p className="text-lg font-semibold text-text-100">
              Tanlangan qism uchun vizual mos mahsulot topilmadi
            </p>
            <p className="mt-2 text-sm text-text-400">
              Boshqa qismni tanlang yoki butun rasmni sinab ko&apos;ring.
            </p>
          </div>
        ) : hasActiveResults ? (
          viewMode === "list" ? (
            <motion.div key="photo-list" layout className="flex flex-col gap-4">
              {filteredItems.map((product, i) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <ProductCard
                    product={product}
                    variant="list"
                    onBand={setSelected}
                    onOpen={(p) => router.push(`/product/${p.id}`)}
                  />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="photo-grid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            >
              <DiscoveryProductGrid products={filteredItems} onBand={setSelected} />
            </motion.div>
          )
        ) : (
          <SearchEmptyState
            query={isPhotoMode ? photoSearch?.query_label : appliedQuery}
            photoMode={isPhotoMode}
            suggestions={trendSuggestions}
          />
        )}
      </div>

      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      <BottomNav />
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageFallback />}>
      <SearchPageContent />
    </Suspense>
  );
}
