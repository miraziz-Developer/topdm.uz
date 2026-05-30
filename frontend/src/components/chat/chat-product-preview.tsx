"use client";

import Image from "next/image";
import Link from "next/link";

import { productImage } from "@/lib/media";
import { formatPrice } from "@/lib/utils";

export type ChatProductPreview = {
  product_id: string;
  name: string;
  price: number;
  shop_number?: string;
  images?: string[];
};

type ChatProductPreviewCardProps = {
  product: ChatProductPreview;
};

export function ChatProductPreviewCard({ product }: ChatProductPreviewCardProps) {
  return (
    <Link
      href={`/product/${product.product_id}`}
      className="mt-2 flex gap-3 rounded-xl border border-border-subtle bg-white/90 p-2 shadow-sm transition hover:border-electric-500/30 hover:shadow-card"
    >
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-elevated">
        <Image
          src={productImage(product.images)}
          alt={product.name}
          fill
          className="object-cover"
          sizes="64px"
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-semibold text-ink-900">{product.name}</p>
        <p className="mt-0.5 text-xs font-bold text-electric-500">{formatPrice(product.price)}</p>
        {product.shop_number ? (
          <p className="mt-0.5 text-[10px] font-medium text-ink-500">Do&apos;kon: {product.shop_number}</p>
        ) : null}
      </div>
    </Link>
  );
}

export function parseChatProducts(metadata: Record<string, unknown> | undefined): ChatProductPreview[] {
  const raw = metadata?.products;
  if (!Array.isArray(raw)) return [];
  const items: ChatProductPreview[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const id = String(row.product_id ?? row.id ?? "");
    const name = String(row.name ?? "");
    const price = Number(row.price ?? 0);
    if (!id || !name) continue;
    items.push({
      product_id: id,
      name,
      price,
      shop_number: row.shop_number ? String(row.shop_number) : undefined,
      images: Array.isArray(row.images) ? (row.images as string[]) : undefined,
    });
  }
  return items;
}
