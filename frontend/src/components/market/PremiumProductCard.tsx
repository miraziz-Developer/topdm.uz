"use client";

import Image from "next/image";
import Link from "next/link";

import { marketCard, marketPrice } from "@/components/market/market-ui";
import { formatUzs } from "@/lib/premium-market";

type Props = {
  href: string;
  name: string;
  price: number;
  imageUrl: string;
  badge?: string;
};

export function PremiumProductCard({ href, name, price, imageUrl, badge }: Props) {
  return (
    <Link href={href} className={`group block ${marketCard}`}>
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-input">
        <Image
          src={imageUrl}
          alt={name}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          unoptimized
          sizes="(max-width: 640px) 50vw, 25vw"
        />
        {badge ? (
          <span className="absolute left-2 top-2 rounded-lg border border-border-subtle bg-white/95 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-electric-500 shadow-sm">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="space-y-2 p-4">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">{name}</p>
        <p className={marketPrice}>{formatUzs(price)}</p>
      </div>
    </Link>
  );
}
