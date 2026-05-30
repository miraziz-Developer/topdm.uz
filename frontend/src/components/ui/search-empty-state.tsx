"use client";

import { Camera, Search } from "lucide-react";
import Link from "next/link";

import { BrandEmptyState } from "@/components/brand/brand-empty-state";
import { Button } from "@/components/ui/button";
import type { Product } from "@/types";

type SearchEmptyStateProps = {
  query?: string;
  photoMode?: boolean;
  suggestions: Product[];
};

export function SearchEmptyState({ query, photoMode, suggestions }: SearchEmptyStateProps) {
  const Icon = photoMode ? Camera : Search;

  return (
    <BrandEmptyState
      title={query ? `"${query}" bo'yicha natija yo'q` : "Qidiruvni boshlang"}
      description={
        photoMode
          ? "Boshqa burchakdan rasm yuboring yoki AI chatda look/budjetni matn bilan yozing."
          : "Filtrlarni yumshating yoki AI Stilistdan kombinatsiya so'rang."
      }
      icon={Icon}
    >
      {suggestions.length > 0 ? (
        <>
          <p className="text-sm font-medium text-text-100">Tavsiya etilganlar</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {suggestions.slice(0, 4).map((product) => (
              <Link
                key={product.id}
                href={`/product/${product.id}`}
                className="rounded-2xl border border-border-subtle px-4 py-3 text-left transition hover:border-electric-500/40 hover:bg-elevated/50 active:scale-[0.99]"
              >
                <p className="line-clamp-2 text-sm font-medium text-text-100">{product.name}</p>
                <p className="mt-1 text-xs text-text-400">{product.shop?.name || product.shop?.ipadrom}</p>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/">
          <Button variant="secondary">Bosh sahifa</Button>
        </Link>
        <Link href="/stylist">
          <Button variant="secondary">AI Stilist</Button>
        </Link>
      </div>
    </BrandEmptyState>
  );
}
