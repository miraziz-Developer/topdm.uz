"use client";

import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, ChevronRight, Eye, MapPin, Phone, Share2, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductCard } from "@/components/ProductCard";
import { AIChat } from "@/components/AIChat";
import { Button } from "@/components/ui/button";
import { getProduct, getSimilarProducts } from "@/lib/api";
import { formatPrice, getRefToken } from "@/lib/utils";
import { useTracking } from "@/hooks/useTracking";
import type { Product } from "@/types";

export default function ProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const [product, setProduct] = useState<Product | null>(null);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [bandOpen, setBandOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const { emit } = useTracking();

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const [p, s] = await Promise.all([getProduct(id), getSimilarProducts(id)]);
        const normalized = p as Product;
        setProduct(normalized);
        setSimilar(((s as { items?: Product[] }).items || []) as Product[]);
        await emit({
          event_type: "view",
          product_id: normalized.id,
          shop_id: normalized.shop?.id,
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

  const imageUrl = product?.images?.[selectedImage] || product?.images?.[0] || "/placeholder.png";

  return (
    <main className="min-h-screen bg-canvas pb-20 md:pb-6">
      <Navigation />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-text-400">
          <Link href="/" className="transition-colors hover:text-text-100">Bosh sahifa</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/search" className="transition-colors hover:text-text-100">Qidiruv</Link>
          {product && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-text-200 truncate max-w-[200px]">{product.name}</span>
            </>
          )}
        </nav>

        {loading ? (
          <div className="grid gap-8 md:grid-cols-2">
            <div className="skeleton aspect-square rounded-2xl" />
            <div className="space-y-4">
              <div className="skeleton h-8 w-3/4 rounded-lg" />
              <div className="skeleton h-6 w-1/2 rounded-lg" />
              <div className="skeleton h-12 w-1/3 rounded-lg" />
              <div className="skeleton h-14 w-full rounded-xl" />
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-400">
              {error}
            </div>
            <Button variant="secondary" onClick={() => router.back()} leftIcon={<ArrowLeft className="h-4 w-4" />}>
              Orqaga
            </Button>
          </div>
        ) : product ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
            {/* Main content */}
            <div className="grid gap-8 md:grid-cols-2">
              {/* Left — Photo Gallery */}
              <div className="space-y-3">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-border-subtle bg-surface">
                  <Image
                    src={imageUrl}
                    alt={product.name}
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 50vw"
                  />
                </div>
                {product.images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {product.images.map((img, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedImage(i)}
                        className={`relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                          selectedImage === i ? "border-gold-500 shadow-gold" : "border-border-subtle hover:border-border-strong"
                        }`}
                      >
                        <Image src={img} alt="" fill className="object-cover" sizes="64px" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right — Details */}
              <div className="space-y-6">
                <div>
                  <span className="mb-2 inline-block rounded-full bg-surface px-3 py-1 text-xs font-medium text-text-300">
                    {product.category || "Tovar"}
                  </span>
                  <h1 className="mt-2 text-3xl font-bold text-text-100">{product.name}</h1>
                </div>

                <div className="h-px bg-border-subtle" />

                <div className="price-mono text-4xl font-bold text-gold-500">
                  {formatPrice(product.price)}
                </div>

                <div className="h-px bg-border-subtle" />

                {/* Shop info */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-text-200">
                    <Store className="h-5 w-5 text-gold-500" />
                    <span className="font-medium">{product.shop.name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-text-300">
                    <MapPin className="h-5 w-5 text-text-400" />
                    <span>{product.shop.ipadrom || "Bozor"} {product.shop.floor ? `• ${product.shop.floor}` : ""}</span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button size="lg" className="flex-1" leftIcon={<Phone className="h-5 w-5" />} onClick={() => setBandOpen(true)}>
                    Band qilish
                  </Button>
                  <Button
                    size="lg"
                    variant="secondary"
                    leftIcon={<Share2 className="h-5 w-5" />}
                    onClick={() =>
                      navigator.share?.({
                        title: product.name,
                        text: `${product.name} — Bozor AI`,
                        url: `${location.origin}/product/${product.id}?ref=${getRefToken()}`,
                      })
                    }
                  >
                    Ulashish
                  </Button>
                </div>

                {/* Status */}
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  {product.is_available && (
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <CheckCircle className="h-4 w-4" /> Hozir mavjud
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-text-400">
                    <Eye className="h-4 w-4" /> {product.view_count || 0} ko'rildi
                  </span>
                </div>
              </div>
            </div>

            {/* Similar products */}
            {similar.length > 0 && (
              <section>
                <h2 className="mb-6 text-2xl font-bold text-text-100">O'xshash tovarlar</h2>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {similar.map((item) => (
                    <ProductCard
                      key={item.id}
                      product={item}
                      variant="compact"
                      onBand={() => setBandOpen(true)}
                      onOpen={(p) => router.push(`/product/${p.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </motion.div>
        ) : (
          <div className="py-20 text-center text-text-400">Tovar topilmadi.</div>
        )}
      </div>
      <BandQilishModal product={product} isOpen={bandOpen} onClose={() => setBandOpen(false)} />
      <AIChat />
      <BottomNav />
    </main>
  );
}
