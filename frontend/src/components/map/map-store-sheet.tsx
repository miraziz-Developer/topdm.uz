"use client";

import { motion } from "framer-motion";
import { Star, Store, X } from "lucide-react";
import Link from "next/link";

import { ShopMapPopupContent } from "@/components/map/shop-map-popup";
import { ShopLocationDetailsCard } from "@/components/map/shop-location-details";
import { locationDetailsFromMarker } from "@/lib/map/shop-location-display";
import type { ShopPopupData } from "@/hooks/useIppodromMapPage";
import { cn } from "@/lib/utils";

type MapStoreSheetProps = {
  data: ShopPopupData;
  onClose: () => void;
  className?: string;
};

export function MapStoreSheet({ data, onClose, className }: MapStoreSheetProps) {
  const rating = data.shop.rating;
  const location = locationDetailsFromMarker(data.shop);
  const block = data.shop.pin.block.toUpperCase();
  const stall = data.shop.pin.stall.toString().toUpperCase();
  const shopCode = (data.shop.slug || data.shop.id).slice(0, 6).toUpperCase();

  return (
    <motion.div
      initial={{ y: "100%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 30, stiffness: 340 }}
      className={cn(
        "pointer-events-auto overflow-hidden rounded-t-[1.75rem] border border-white/60 bg-white/88 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur-xl",
        "animate-in slide-in-from-bottom-5 fade-in duration-300",
        className,
      )}
    >
      <div className="mx-auto mt-2.5 h-1 w-11 rounded-full bg-neutral-300/80" aria-hidden />

      <div className="relative px-1 pb-5 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/95 text-ink-500 shadow-sm backdrop-blur-sm"
          aria-label="Yopish"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="px-4 pt-2">
          <div className="flex items-center gap-3 border-b border-neutral-200/50 pb-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-600/30">
              <Store className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 pr-8">
              <p className="truncate text-base font-bold text-ink-900">{data.shop.name}</p>
              <p className="mt-1 inline-flex max-w-full items-center gap-1.5 truncate rounded-full border border-electric-500/25 bg-electric-500/8 px-2.5 py-1 text-[10px] font-semibold text-electric-700">
                {`${data.shop.ipadrom || "Ippodrom"} ${block}-blok, rasta ${stall} | Do'kon ID: #${shopCode}`}
              </p>
              {rating != null && rating > 0 ? (
                <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {rating.toFixed(1)}
                  <span className="font-normal text-ink-400">reyting</span>
                </p>
              ) : null}
            </div>
          </div>

          <ShopLocationDetailsCard location={location} compact className="mt-3" />
          <ShopMapPopupContent data={data} compact hideLocation />

          {data.shop.slug ? (
            <Link href={`/shop/${data.shop.slug}`} className="mt-4 block">
              <span className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]">
                Do&apos;konga kirish
              </span>
            </Link>
          ) : data.shop.id ? (
            <Link href={`/merchant/${data.shop.id}`} className="mt-4 block">
              <span className="flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-3.5 text-sm font-bold tracking-wide text-white shadow-lg shadow-blue-600/30 transition hover:scale-[1.02] hover:opacity-95 active:scale-[0.98]">
                Do&apos;konga kirish
              </span>
            </Link>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
