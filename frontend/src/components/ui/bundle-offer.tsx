"use client";

import Image from "next/image";
import Link from "next/link";

import { formatPrice } from "@/lib/utils";
import type { Product } from "@/types";

type BundleOfferProps = {
  primary: Product;
  related: Product[];
};

export function BundleOffer({ primary, related }: BundleOfferProps) {
  const bundle = related.slice(0, 2);
  if (!bundle.length) return null;

  const total = primary.price + bundle.reduce((sum, item) => sum + item.price, 0);
  const discounted = Math.round(total * 0.95);

  return (
    <section className="rounded-3xl border border-neon-500/20 bg-neon-500/5 p-5">
      <h3 className="text-lg font-semibold text-ink-900">Birgalikda sotib olinadi</h3>
      <p className="mt-1 text-sm text-ink-500">Komplekt qilib oling va umumiy narxdan 5% tejang.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {[primary, ...bundle].map((item) => (
          <Link key={item.id} href={`/product/${item.id}`} className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-white p-3">
            <div className="relative h-16 w-16 overflow-hidden rounded-xl bg-elevated">
              <Image src={item.images?.[0] || "/placeholder.png"} alt={item.name} fill className="object-cover" sizes="64px" />
            </div>
            <div>
              <p className="line-clamp-2 text-sm font-medium text-ink-900">{item.name}</p>
              <p className="price-mono mt-1 text-sm font-bold text-neon-500">{formatPrice(item.price)}</p>
            </div>
          </Link>
        ))}
      </div>
      <p className="price-mono mt-4 text-lg font-bold text-ink-900">
        Komplekt: <span className="text-neon-500">{formatPrice(discounted)}</span>{" "}
        <span className="text-sm font-normal text-ink-500 line-through">{formatPrice(total)}</span>
      </p>
    </section>
  );
}
