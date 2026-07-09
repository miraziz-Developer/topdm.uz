"use client";

import Image from "next/image";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";

type Props = {
  images: string[];
  alt: string;
};

export function PremiumImageGallery({ images, alt }: Props) {
  const gallery = images.length ? images : ["/brand/bozorliii-product-placeholder.svg"];
  const [index, setIndex] = useState(0);
  const active = gallery[index] ?? gallery[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-card">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, scale: 1.02 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0 bg-bg-input"
          >
            <Image src={active} alt={alt} fill className="object-cover" unoptimized sizes="(max-width:768px) 100vw, 50vw" />
          </motion.div>
        </AnimatePresence>
      </div>
      {gallery.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {gallery.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white transition-all duration-200",
                i === index ? "border-electric-500 shadow-sm" : "border-border-subtle opacity-80 hover:opacity-100",
              )}
            >
              <Image src={src} alt="" fill className="object-cover" unoptimized />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
