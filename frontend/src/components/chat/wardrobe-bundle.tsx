"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, MapPin, Sparkles } from "lucide-react";
import Link from "next/link";

import { ProductImage } from "@/components/ui/product-image";
import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

export type WardrobeSlot = {
  role: string;
  product_id: string;
  item: Product;
};

const ROLE_META: Record<
  string,
  { label: string; subtitle: string; accent: string }
> = {
  ustki: {
    label: "Ustki qism",
    subtitle: "Silhouette Top · Polo / Shirt",
    accent: "from-electric-500/20 to-transparent",
  },
  pastki: {
    label: "Pastki qism",
    subtitle: "Classic Bottom · Chino / Shim",
    accent: "from-gold-500/15 to-transparent",
  },
  poyabzal: {
    label: "Poyabzal",
    subtitle: "Footwear",
    accent: "from-violet-500/15 to-transparent",
  },
  aksessuar: {
    label: "Aksessuar",
    subtitle: "Accent piece",
    accent: "from-rose-500/10 to-transparent",
  },
};

export type WardrobeBundleProps = {
  slots: WardrobeSlot[];
  budgetTotal?: number;
  searchHref?: string;
  onNavigate?: () => void;
};

function slotMeta(role: string) {
  return (
    ROLE_META[role] ?? {
      label: role,
      subtitle: "Look piece",
      accent: "from-white/10 to-transparent",
    }
  );
}

function WardrobePieceCard({
  slot,
  onNavigate,
}: {
  slot: WardrobeSlot;
  onNavigate?: () => void;
}) {
  const product = slot.item;
  const meta = slotMeta(slot.role);
  const location = [product.shop?.floor, product.shop?.section || product.shop?.shop_number]
    .filter(Boolean)
    .join(" · ");

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 380, damping: 28 }}
      className="group relative flex min-h-[220px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-xl backdrop-blur-md"
    >
      <div className={`absolute inset-0 bg-gradient-to-b ${meta.accent} opacity-80`} />
      <Link
        href={`/product/${product.id}`}
        onClick={onNavigate}
        className="relative z-10 flex flex-1 flex-col p-4"
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold-400">{meta.label}</p>
            <p className="mt-0.5 text-[11px] text-white/50">{meta.subtitle}</p>
          </div>
          <span className="rounded-full border border-white/10 bg-black/20 px-2 py-0.5 text-[10px] text-white/70">
            {slot.role}
          </span>
        </div>
        <div className="relative mx-auto mb-3 aspect-[3/4] w-full max-w-[140px] overflow-hidden rounded-xl border border-white/10 bg-black/20">
          <ProductImage
            images={product.images}
            alt={product.name}
            fill
            className="object-cover transition duration-500 group-hover:scale-110"
            sizes="160px"
          />
        </div>
        <p className="line-clamp-2 text-center text-sm font-semibold text-white">{product.name}</p>
        <p className="price-mono mt-2 text-center text-lg font-bold text-electric-400">{formatPrice(product.price)}</p>
        {location ? (
          <p className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/45">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{location}</span>
          </p>
        ) : null}
      </Link>
    </motion.div>
  );
}

export function WardrobeBundle({ slots, budgetTotal, searchHref, onNavigate }: WardrobeBundleProps) {
  if (!slots.length) return null;

  const total =
    budgetTotal ??
    slots.reduce((sum, s) => sum + (typeof s.item.price === "number" ? s.item.price : 0), 0);

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 shadow-xl backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-gold">
            <Sparkles className="h-4 w-4 text-canvas" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-400">Elite Look Showcase</p>
            <p className="text-[11px] text-white/50">Executive closet bundle</p>
          </div>
        </div>
        <div className="rounded-xl border border-gold-500/30 bg-gold-500/10 px-3 py-2 text-right">
          <p className="text-[10px] uppercase tracking-wider text-gold-300/80">Look jami</p>
          <p className="price-mono text-base font-bold text-gold-200">{formatPrice(total)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {slots.map((slot) => (
          <WardrobePieceCard key={slot.product_id} slot={slot} onNavigate={onNavigate} />
        ))}
      </div>

      {searchHref ? (
        <Link
          href={searchHref}
          onClick={onNavigate}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:border-gold-500/40 hover:bg-gold-500/15"
        >
          Ko&apos;proq variantlarni qidiruv sahifasida ko&apos;rish
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
