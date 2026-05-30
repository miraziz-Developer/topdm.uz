"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

import { LivePill } from "@/components/ui/live-pill";
import { hasProductImage, PLACEHOLDER_BOUTIQUE, productImage } from "@/lib/media";
import type { Product } from "@/types";

const BOUTIQUE_IMAGES = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&q=80",
  "https://images.unsplash.com/photo-1555529669-e93e6600f2d0?w=400&q=80",
  "https://images.unsplash.com/photo-1567401893414-76b7b1e0a7a7?w=400&q=80",
];

type Story = {
  id: string;
  label: string;
  image: string;
  href: string;
  live?: boolean;
};

type LiveStoriesDockProps = {
  products: Product[];
};

function pickImage(product: Product | undefined, index: number): string {
  if (product && hasProductImage(product.images)) return productImage(product.images);
  return BOUTIQUE_IMAGES[index % BOUTIQUE_IMAGES.length] ?? PLACEHOLDER_BOUTIQUE;
}

export function LiveStoriesDock({ products }: LiveStoriesDockProps) {
  const stories: Story[] = [
    {
      id: "floor-1",
      label: products[0]?.shop?.floor || "1-qavat",
      image: pickImage(products[0], 0),
      href: products[0] ? `/product/${products[0].id}` : "/search",
      live: true,
    },
    {
      id: "floor-2",
      label: products[1]?.shop?.floor || "2-qavat",
      image: pickImage(products[1], 1),
      href: products[1] ? `/product/${products[1].id}` : "/search",
      live: true,
    },
    {
      id: "new-drop",
      label: "Yangi kolleksiya",
      image: pickImage(products[2], 2),
      href: products[2] ? `/product/${products[2].id}` : "/search",
    },
    {
      id: "featured",
      label: products[3]?.shop?.section ? `${products[3].shop.section}` : "Tanlangan",
      image: pickImage(products[3], 0),
      href: "/search",
    },
  ];

  return (
    <div className="pointer-events-none fixed bottom-[calc(var(--app-bottom-nav-h)+0.5rem)] left-3 z-40 md:bottom-8 md:left-4">
      <div className="pointer-events-auto flex max-w-[calc(100vw-1.5rem)] gap-3 scroll-x-contained pb-1">
        {stories.map((story, index) => (
          <motion.div
            key={story.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Link href={story.href} className="flex w-16 flex-col items-center gap-1">
              <div className="relative rounded-full bg-gradient-electric p-[2px]">
                <div className="relative h-14 w-14 overflow-hidden rounded-full border-2 border-white bg-ink-900">
                  <Image src={story.image} alt={story.label} fill className="object-cover" sizes="56px" />
                </div>
                {story.live ? (
                  <span className="absolute -right-1 -top-1">
                    <LivePill className="scale-75" />
                  </span>
                ) : null}
              </div>
              <span className="max-w-16 truncate rounded-md px-1.5 py-0.5 text-[10px] font-bold text-ink-800 backdrop-blur-md bg-white/70">
                {story.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
