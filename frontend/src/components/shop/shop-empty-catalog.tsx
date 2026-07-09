"use client";

import { Bell, MapPin, Sparkles, Store } from "lucide-react";
import Link from "next/link";

import { shopCardShell } from "@/components/shop/shop-premium-ui";
import { cn } from "@/lib/utils";

type Props = {
  shopName: string;
  shopSlug: string;
  className?: string;
};

export function ShopEmptyCatalog({ shopName, shopSlug, className }: Props) {
  return (
    <div className={cn(shopCardShell, "shop-empty-catalog", className)}>
      <div className="shop-empty-catalog__glow" aria-hidden />
      <div className="relative px-6 py-12 text-center sm:px-10 sm:py-14">
        <span className="shop-empty-catalog__icon" aria-hidden>
          <Store className="h-8 w-8" />
        </span>

        <p className="eyebrow-pill-gold mx-auto mt-5 w-fit">
          <Sparkles className="h-3.5 w-3.5" aria-hidden />
          Tez kunda yangi kolleksiya
        </p>

        <h2 className="mt-4 text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">
          Hozircha mahsulot yo&apos;q
        </h2>
        <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-text-400">
          <strong className="font-semibold text-ink-700">{shopName}</strong> yangi mahsulotlarni
          tez orada qo&apos;shadi. Birinchi bo&apos;lib ko&apos;ring — do&apos;konga boring yoki
          xaritadan joylashuvni tekshiring.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`/map?shop=${encodeURIComponent(shopSlug)}`}
            className="sales-cta shop-cta-pulse inline-flex min-w-[200px] items-center justify-center gap-2 px-6 py-3.5 text-[15px]"
          >
            <MapPin className="h-4 w-4" />
            Do&apos;konni xaritada ko&apos;rish
          </Link>
          <a
            href="https://t.me/Bozorliiicrm_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="shop-hero-btn shop-hero-btn--secondary inline-flex min-w-[200px] items-center justify-center gap-2"
          >
            <Bell className="h-4 w-4" />
            Yangiliklardan xabardor bo&apos;lish
          </a>
        </div>

        <p className="social-proof-line mx-auto mt-6 max-w-sm">
          O&apos;zbekiston bozoriga ishonchli onlayn vitrina
        </p>
      </div>
    </div>
  );
}
