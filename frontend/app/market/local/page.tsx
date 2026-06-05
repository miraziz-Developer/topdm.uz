"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { MarketShell } from "@/components/market/MarketShell";
import { PremiumProductCard } from "@/components/market/PremiumProductCard";
import { getJson } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";

type ProductRow = {
  id: string;
  name: string;
  price: number;
  images?: string[];
};

export default function LocalMarketHubPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJson<{ items: ProductRow[] }>("/products/search?limit=24")
      .then((res) => setItems(res.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <MarketShell
      title="Ichki bozor"
      subtitle="Mahalliy do'konlar — tez kuryer, aniq ombor, yakuniy narx bilan"
    >
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-sm text-white/45">Hozircha mahsulot topilmadi</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => (
            <PremiumProductCard
              key={p.id}
              href={`/market/local/${p.id}`}
              name={p.name}
              price={p.price}
              imageUrl={resolveMediaUrl(p.images?.[0]) ?? "/placeholder.png"}
              badge="Mahalliy"
            />
          ))}
        </div>
      )}
    </MarketShell>
  );
}
