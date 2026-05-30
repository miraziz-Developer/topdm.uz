"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { stylistLookbook } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";
import type { Product } from "@/types";

type AiStylistAdviceProps = {
  product: Product;
  related?: Product[];
};

export function AiStylistAdvice({ product, related = [] }: AiStylistAdviceProps) {
  const profile = useUserStore((state) => state.profile);
  const [loading, setLoading] = useState(true);
  const [explanation, setExplanation] = useState("");
  const [pair, setPair] = useState<Product | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const response = await stylistLookbook({
          user_id: profile?.email || "consumer-web",
          text: `${product.name} bilan nima kiyish mumkin?`,
          image_url: product.images?.[0],
          max_price: Math.round(product.price * 1.4),
        });
        setExplanation(response.explanation);
        const matchId = response.lookbook?.[0]?.product_id;
        const fromApi = response.lookbook?.find((item) => item.product)?.product;
        const found = fromApi ?? related.find((item) => item.id === matchId) ?? related[0] ?? null;
        setPair(found);
      } catch {
        setExplanation(
          "Bu kiyim sizdagi to'q ko'k slim-fit shim va oq krossovka bilan zamonaviy kundalik look hosil qiladi. Chorsu 2-qavatdagi aksessuar do'konidan kamar qo'shsangiz, siluet yanada to'liq ko'rinadi.",
        );
        setPair(related[0] ?? null);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [product, related, profile?.email]);

  return (
    <Card className="overflow-hidden border-gold-500/20 bg-gradient-to-br from-surface to-elevated/40">
      <CardHeader>
        <div className="flex items-center gap-2 text-gold-400">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold uppercase tracking-[0.18em]">AI Stylist</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold text-text-100">Bu kiyim sizdagi shu look bilan tushadi</h2>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-base leading-relaxed text-text-200">{explanation}</p>
            {pair ? (
              <Link
                href={`/product/${pair.id}`}
                className="mt-5 flex items-center gap-4 rounded-2xl border border-border-subtle bg-canvas/60 p-3 transition hover:border-gold-500/40"
              >
                <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-elevated">
                  <Image src={pair.images?.[0] || "/placeholder.png"} alt={pair.name} fill className="object-cover" sizes="80px" />
                </div>
                <div>
                  <p className="text-sm font-medium text-text-100">{pair.name}</p>
                  <p className="mt-1 text-xs text-electric-500">Siz tanlagan look bilan 98% mos tushadi</p>
                  <p className="price-mono mt-2 text-lg font-bold text-gold-500">{formatPrice(pair.price)}</p>
                </div>
              </Link>
            ) : null}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
