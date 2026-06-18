"use client";

import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductDetail } from "@/components/product/ProductDetail";
import { productPageBg, productSectionDivider, productThumb, productThumbActive, productVariantPanel } from "@/components/product/product-premium-ui";
import { ShopLiveChat } from "@/components/product/shop-live-chat";
import { AiStylistAdvice } from "@/components/product/ai-stylist-advice";
import { ProductReviewsSection } from "@/components/product/product-reviews-section";
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
import { productImage } from "@/lib/media";
import {
  extractSelectableOptions,
  galleryImagesForSelection,
  imagesForColor,
  isSelectionInStock,
  sizesForColor,
} from "@/lib/product-options";
import { ProductImage } from "@/components/ui/product-image";
import { saveLastShop } from "@/lib/personalization/client-hints";
import { cn, getRefToken } from "@/lib/utils";
import type { Product } from "@/types";

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
    const firstColor =
      options.colors.find((color) =>
        sizesForColor(product, color).some((size) =>
          isSelectionInStock(product, { color, size }),
        ),
      ) ??
      options.colors[0] ??
      "";
    const sizes = sizesForColor(product, firstColor);
    const firstSize =
      sizes.find((size) => isSelectionInStock(product, { color: firstColor, size })) ??
      sizes[0] ??
      options.sizes[0] ??
      "";
    setSelectedColor(firstColor);
    setSelectedSize(firstSize);
    setSelectedImage(0);
  }, [product]);

  const galleryImages =
    product && selectedColor
      ? galleryImagesForSelection(product, { color: selectedColor })
      : product?.images ?? [];
  const heroImage = productImage(galleryImages, selectedImage);
  const selectionInStock = product
    ? isSelectionInStock(product, { size: selectedSize || undefined, color: selectedColor || undefined })
    : true;
  const options = product ? extractSelectableOptions(product) : { sizes: [], colors: [] };
  const sizesForSelectedColor = product ? sizesForColor(product, selectedColor) : options.sizes;

  useEffect(() => {
    setSelectedImage(0);
    if (!product || !selectedColor) return;
    const allowed = sizesForColor(product, selectedColor);
    if (!allowed.length) return;
    const inStock =
      allowed.find((size) =>
        isSelectionInStock(product, { color: selectedColor, size }),
      ) ?? allowed[0] ?? "";
    setSelectedSize((prev) =>
      prev && allowed.includes(prev) && isSelectionInStock(product, { color: selectedColor, size: prev })
        ? prev
        : inStock,
    );
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
    <main className={cn("page-shell md:pb-6", productPageBg)}>
      <Navigation />
      <div className="page-content-top mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <nav className="mb-5 flex items-center gap-2 text-xs text-ink-400 sm:text-sm">
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 sm:space-y-8">
            <motion.div className="grid gap-8 lg:grid-cols-2 lg:items-start lg:gap-10 xl:gap-14">
              <div className="space-y-4">
                <ImageMagnifier images={galleryImages} index={selectedImage} alt={product.name} />
                {galleryImages.length > 1 ? (
                  <div className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {galleryImages.map((img, index) => (
                      <button
                        key={`${img}-${index}`}
                        type="button"
                        onClick={() => setSelectedImage(index)}
                        className={cn(
                          productThumb,
                          selectedImage === index ? productThumbActive : "opacity-80 hover:opacity-100",
                        )}
                      >
                        <ProductImage
                          images={[img, ...galleryImages.filter((_, i) => i !== index)]}
                          index={0}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="72px"
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
                {(options.colors.length || options.sizes.length) ? (
                  <div className={cn(productVariantPanel, "space-y-4")}>
                    {options.colors.length ? (
                      <div>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">Rang</p>
                        <div className="flex flex-wrap gap-2">
                          {options.colors.map((color) => {
                            const thumbImages = product ? imagesForColor(product, color) : [];
                            const colorSizes = product ? sizesForColor(product, color) : [];
                            const colorAvailable = product
                              ? colorSizes.some((size) =>
                                  isSelectionInStock(product, { color, size }),
                                )
                              : true;
                            return (
                              <button
                                key={color}
                                type="button"
                                disabled={!colorAvailable}
                                onClick={() => {
                                  setSelectedColor(color);
                                  setSelectedImage(0);
                                }}
                                className={cn(
                                  "flex items-center gap-2 rounded-full border px-2 py-1.5 text-xs font-medium transition-all",
                                  selectedColor === color
                                    ? "border-ink-900 bg-ink-900 text-white shadow-sm"
                                    : "border-black/[0.08] bg-white text-ink-700 hover:border-ink-300",
                                  !colorAvailable && "cursor-not-allowed opacity-40",
                                )}
                              >
                                {thumbImages.length ? (
                                  <span className="relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-black/10">
                                    <ProductImage
                                      images={thumbImages}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="28px"
                                    />
                                  </span>
                                ) : null}
                                {color}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                    {sizesForSelectedColor.length ? (
                      <div>
                        <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-ink-400">Razmer</p>
                        <div className="flex flex-wrap gap-2">
                          {sizesForSelectedColor.map((size) => {
                            const sizeAvailable = product
                              ? isSelectionInStock(product, {
                                  color: selectedColor || undefined,
                                  size,
                                })
                              : true;
                            return (
                              <button
                                key={size}
                                type="button"
                                disabled={!sizeAvailable}
                                onClick={() => setSelectedSize(size)}
                                className={cn(
                                  "min-w-[2.75rem] rounded-xl border px-3 py-2 text-sm font-medium transition-all",
                                  selectedSize === size
                                    ? "border-ink-900 bg-ink-900 text-white shadow-sm"
                                    : "border-black/[0.08] bg-white text-ink-700 hover:border-ink-300",
                                  !sizeAvailable && "cursor-not-allowed opacity-40 line-through",
                                )}
                              >
                                {size}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="rounded-2xl border border-black/[0.05] bg-white/50 px-4 py-3 text-center text-xs text-ink-500">
                    Variantlar ko&apos;rsatilmagan — aniq razmer/rang uchun &quot;Band qilish&quot; tugmasidan foydalaning
                  </p>
                )}
              </div>

              <div className="lg:sticky lg:top-24 lg:self-start">
              <ProductDetail
                product={product}
                onCopyId={() => void copyProductId()}
                onReserveGroup={() => push("Mahsulot savatchaga qo'shildi", "success")}
                onBandOpen={() => setBandOpen(true)}
                selectedOptions={{
                  size: selectedSize || undefined,
                  color: selectedColor || undefined,
                }}
                forceInlineSelection={Boolean(options.sizes.length || options.colors.length)}
                onRequireSelection={() =>
                  push(
                    !selectionInStock ? "Tanlangan variant omborda yo'q" : "Avval rang/razmer tanlang",
                    "error",
                  )
                }
              />
              </div>
            </motion.div>

            <div className={cn(productSectionDivider, "space-y-6")}>
              <SizeRecommender sizes={options.sizes} category={product.category_name ?? product.category} />
              <ProductReviewsSection
                productId={product.id}
                productName={product.name}
                initialSummary={product.review_summary}
              />
            </div>

            <div className={cn(productSectionDivider, "space-y-8")}>
              <ContextualAiSidebar product={product} />
              <BundleOffer primary={product} related={similar} />
              <AiStylistAdvice product={product} related={similar} />
              <VisualSimilarityRail sourceImage={heroImage} items={similar} />
            </div>
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
