"use client";

import { motion } from "framer-motion";
import { Eye, VolumeX } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";

import { LivePill } from "@/components/ui/live-pill";
import { SectionHeader } from "@/components/ui/section-header";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

const LIVE_CLIPS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

type TrendingLiveRailProps = {
  products: Product[];
  loading?: boolean;
};

export function TrendingLiveRail({ products, loading }: TrendingLiveRailProps) {
  if (loading) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-10">
        <SectionHeader eyebrow="Ippodrom live" title="Trending Live" description="Chorsu va Yunusobod bloklarida hozir eng ko'p sotilayotgan tovarlar." />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="skeleton h-[360px] w-[220px] shrink-0 rounded-3xl" />
          ))}
        </div>
      </section>
    );
  }

  if (!products.length) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <SectionHeader
        eyebrow="Ippodrom live"
        title="Trending Live"
        description="Sotuvchilar jonli ko'rsatuvda narxni pasaytirayotganda xaridorlar bir zumda band qiladi."
        action={<LivePill />}
      />
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {products.slice(0, 6).map((product, index) => (
          <LiveCard key={product.id} product={product} clip={LIVE_CLIPS[index % LIVE_CLIPS.length]} />
        ))}
      </div>
    </section>
  );
}

function LiveCard({ product, clip }: { product: Product; clip: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void video.play().catch(() => undefined);
  }, []);

  const poster = product.images?.[0] || "/brand/bozorliii-product-placeholder.svg";

  return (
    <motion.article
      whileHover={{ y: -6 }}
      className="relative w-[220px] shrink-0 overflow-hidden rounded-3xl border border-border-subtle bg-surface shadow-card"
    >
      <Link href={`/product/${product.id}`} className="block">
        <div className="relative aspect-[9/16] bg-elevated">
          <video
            ref={videoRef}
            src={clip}
            poster={poster}
            muted
            loop
            playsInline
            autoPlay
            className="h-full w-full object-cover"
          />
          <Image src={poster} alt="" fill className="pointer-events-none object-cover opacity-0" aria-hidden unoptimized />
          <div className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-transparent" />
          <div className="absolute left-3 top-3">
            <LivePill />
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-canvas/70 px-2 py-1 text-[11px] text-text-200 backdrop-blur">
            <VolumeX className="h-3 w-3" />
            Ovozsiz
          </div>
          <div className="absolute bottom-3 left-3 right-3">
            <p className="line-clamp-2 text-sm font-semibold text-text-100">{product.name}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="price-mono text-base font-bold text-gold-500">{formatPrice(product.price)}</span>
              <span className="flex items-center gap-1 text-xs text-text-300">
                <Eye className="h-3.5 w-3.5" />
                {(product.view_count ?? 120) + 40}
              </span>
            </div>
            <p className="mt-1 text-xs text-text-400">
              {product.shop.ipadrom} • {product.shop.floor || "1-qavat"}
            </p>
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
