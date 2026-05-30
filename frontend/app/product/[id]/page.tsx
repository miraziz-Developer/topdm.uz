"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductDetail } from "@/components/product/ProductDetail";
import { ShopLiveChat } from "@/components/product/shop-live-chat";
import { AiStylistAdvice } from "@/components/product/ai-stylist-advice";
import { InteractiveReviews } from "@/components/product/interactive-reviews";
import { VisualSimilarityRail } from "@/components/product/visual-similarity-rail";
import { emitProductView } from "@/components/providers/price-drop-listener";
import { BundleOffer } from "@/components/ui/bundle-offer";
import { Button } from "@/components/ui/button";
import { ContextualAiSidebar } from "@/components/ui/contextual-ai-sidebar";
import { ImageMagnifier } from "@/components/ui/image-magnifier";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import { SizeRecommender } from "@/components/ui/size-recommender";
import { useToast } from "@/components/ui/toast";
import { useTracking } from "@/hooks/useTracking";
import { getProduct, getSimilarProducts } from "@/lib/api";
import { extractSelectableOptions, sizesForColor } from "@/lib/product-options";
import { saveLastShop } from "@/lib/personalization/client-hints";
import { getRefToken } from "@/lib/utils";
import type { Product } from "@/types";

function normalizeColor(value: string): string {
  return value.trim().toLowerCase();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function collectColorImageMap(product: Product): Record<string, string[]> {
  const attrs = (product.attributes ?? {}) as Record<string, unknown>;
  const map: Record<string, string[]> = {};

  const addImages = (color: string, images: string[]) => {
    const key = normalizeColor(color);
    if (!key || images.length === 0) return;
    const current = map[key] ?? [];
    map[key] = Array.from(new Set([...current, ...images]));
  };

  const directMap = attrs.color_images;
  if (directMap && typeof directMap === "object" && !Array.isArray(directMap)) {
    for (const [color, urls] of Object.entries(directMap as Record<string, unknown>)) {
      addImages(color, asStringArray(urls));
    }
  }

  const variants = Array.isArray(attrs.variants) ? attrs.variants : [];
  for (const row of variants) {
    if (!row || typeof row !== "object") continue;
    const variant = row as Record<string, unknown>;
    const color = String(variant.color ?? "").trim();
    const images = asStringArray(variant.images);
    const single = String(variant.image ?? "").trim();
    if (single) images.push(single);
    addImages(color, images);
  }

  return map;
}

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const id = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bandOpen, setBandOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const { emit } = useTracking();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [item, similarResponse] = await Promise.all([getProduct(id), getSimilarProducts(id)]);
        setProduct(item);
        setSimilar(similarResponse.items || []);
        if (item.shop?.slug && item.shop?.name) {
          saveLastShop({ slug: item.shop.slug, name: item.shop.name });
        }
        emitProductView({
          id: item.id,
          name: item.name,
          price: item.price,
          image: item.images?.[0],
        });
        await emit({
          event_type: "view",
          product_id: item.id,
          ...(item.shop?.id ? { shop_id: item.shop.id } : {}),
          ref_token: getRefToken(),
          metadata: { page: "product_detail" },
        });
      } catch {
        setError("Tovarni yuklab bo'lmadi.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [emit, id]);

  useEffect(() => {
    if (!product) return;
    const options = extractSelectableOptions(product);
    const firstColor = options.colors[0] ?? "";
    const sizes = sizesForColor(product, firstColor);
    setSelectedColor(firstColor);
    setSelectedSize(sizes[0] ?? options.sizes[0] ?? "");
    setSelectedImage(0);
  }, [product]);

  const colorImageMap = product ? collectColorImageMap(product) : {};
  const colorImages = selectedColor ? colorImageMap[normalizeColor(selectedColor)] ?? [] : [];
  const galleryImages = colorImages.length ? colorImages : product?.images ?? [];
  const imageUrl = galleryImages[selectedImage] || galleryImages[0] || "/placeholder.png";
  const options = product ? extractSelectableOptions(product) : { sizes: [], colors: [] };
  const sizesForSelectedColor = product ? sizesForColor(product, selectedColor) : options.sizes;

  useEffect(() => {
    setSelectedImage(0);
    if (!product || !selectedColor) return;
    const allowed = sizesForColor(product, selectedColor);
    if (!allowed.length) return;
    setSelectedSize((prev) => (prev && allowed.includes(prev) ? prev : allowed[0] ?? ""));
  }, [selectedColor, product]);

  const copyProductId = async () => {
    if (!product) return;
    try {
      await navigator.clipboard.writeText(product.id);
      push("Mahsulot ID nusxalandi", "success");
    } catch {
      push("Nusxalab bo'lmadi", "error");
    }
  };

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-6xl px-4 py-6 sm:px-5">
        <nav className="mb-6 flex items-center gap-2 text-sm text-text-400">
          <Link href="/" className="transition-colors hover:text-text-100">
            Bosh sahifa
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/search" className="transition-colors hover:text-text-100">
            Qidiruv
          </Link>
          {product ? (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="max-w-[200px] truncate text-text-200">{product.name}</span>
            </>
          ) : null}
        </nav>

        {loading ? (
          <ProductSkeleton variant="detail" />
        ) : error ? (
          <motion.div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">{error}</div>
            <Button variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Orqaga
            </Button>
          </motion.div>
        ) : product ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            <motion.div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:gap-12">
              <div className="space-y-3">
                <ImageMagnifier src={imageUrl} alt={product.name} />
                {galleryImages.length > 1 ? (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((img, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setSelectedImage(index)}
                        className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                          selectedImage === index ? "border-electric-500 shadow-hover" : "border-border-subtle hover:border-border-strong"
                        }`}
                      >
                        <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                      </button>
                    ))}
                  </div>
                ) : null}
                {(options.colors.length || options.sizes.length) ? (
                  <div className="mt-2 space-y-3 rounded-2xl border border-border-subtle bg-white p-3">
                    {options.colors.length ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Mavjud ranglar</p>
                        <div className="flex flex-wrap gap-2">
                          {options.colors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setSelectedColor(color);
                                setSelectedImage(0);
                              }}
                              className={`rounded-full border px-3 py-1 text-xs ${
                                selectedColor === color
                                  ? "border-electric-500 bg-electric-500/10 text-electric-600"
                                  : "border-border-subtle text-ink-700"
                              }`}
                            >
                              {color}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {sizesForSelectedColor.length ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Razmer tanlang</p>
                        <div className="flex flex-wrap gap-2">
                          {sizesForSelectedColor.map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setSelectedSize(size)}
                              className={`rounded-lg border px-3 py-1.5 text-sm ${
                                selectedSize === size
                                  ? "border-electric-500 bg-electric-500/10 text-electric-600"
                                  : "border-border-subtle text-ink-700"
                              }`}
                            >
                              {size}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                    Bu mahsulot uchun rang/razmer variantlari hali kiritilmagan.
                  </div>
                )}
              </div>

              <ProductDetail
                product={product}
                onCopyId={() => void copyProductId()}
                onReserveGroup={() => push("Guruh buyurtmasi yaratildi", "success")}
                onBandOpen={() => setBandOpen(true)}
                selectedOptions={{
                  size: selectedSize || undefined,
                  color: selectedColor || undefined,
                }}
                forceInlineSelection={Boolean(options.sizes.length || options.colors.length)}
                onRequireSelection={() => push("Avval rang/razmer tanlang", "error")}
              />
            </motion.div>

            <ContextualAiSidebar product={product} />
            <SizeRecommender />
            <BundleOffer primary={product} related={similar} />
            <AiStylistAdvice product={product} related={similar} />
            <VisualSimilarityRail sourceImage={imageUrl} items={similar} />
            <InteractiveReviews productName={product.name} />
          </motion.div>
        ) : (
          <div className="py-20 text-center text-ink-500">Tovar topilmadi.</div>
        )}
      </div>
      <BandQilishModal product={product} isOpen={bandOpen} onClose={() => setBandOpen(false)} />
      {product?.shop?.id ? <ShopLiveChat shopId={product.shop.id} shopName={product.shop.name} /> : null}
      <AIChat />
      <BottomNav />
    </main>
  );
}
