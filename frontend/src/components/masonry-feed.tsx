"use client";

import { motion } from "framer-motion";

const cards = [
  { id: "1", title: "Silk Dress", price: "790,000 UZS" },
  { id: "2", title: "Linen Blazer", price: "620,000 UZS" },
  { id: "3", title: "Classic Heels", price: "540,000 UZS" },
  { id: "4", title: "Pearl Bag", price: "880,000 UZS" },
];

export function MasonryFeed() {
  return (
    <div className="columns-1 gap-4 sm:columns-2 lg:columns-3">
      {cards.map((card) => (
        <motion.article
          key={card.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 break-inside-avoid rounded-2xl border border-zinc-800 bg-zinc-900 p-4"
        >
          <h3 className="font-medium">{card.title}</h3>
          <p className="mt-2 text-sm text-zinc-400">{card.price}</p>
        </motion.article>
      ))}
    </div>
  );
}
