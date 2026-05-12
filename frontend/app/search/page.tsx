"use client";

import { motion } from "framer-motion";
import { Filter, Grid3X3, List, Search, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductCard } from "@/components/ProductCard";
import { BandQilishModal } from "@/components/BandQilishModal";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/types";

const sortOptions = [
  { value: "relevance", label: "Eng mos" },
  { value: "price_asc", label: "Arzonroq" },
  { value: "price_desc", label: "Qimmatroq" },
  { value: "newest", label: "Yangi" },
  { value: "popular", label: "Ko'p ko'rilgan" },
];

export default function SearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState("relevance");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

  const data = useProducts({ q: appliedQuery, page: 1, limit: 24 });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") || params.get("category") || "";
    setQuery(q);
    setAppliedQuery(q);
  }, []);

  const handleSearch = () => {
    setAppliedQuery(query);
    router.replace(`/search?q=${encodeURIComponent(query)}`);
  };

  return (
    <main className="min-h-screen bg-canvas pb-20 md:pb-6">
      <Navigation />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* Search bar */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex flex-1 items-center rounded-xl border border-border-subtle bg-surface transition-all focus-within:border-gold-500/50 focus-within:shadow-gold">
            <Search className="absolute left-4 h-5 w-5 text-text-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Qidirish..."
              className="h-12 w-full rounded-xl bg-transparent pl-12 pr-4 text-text-100 placeholder:text-text-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => { setQuery(""); setAppliedQuery(""); }} className="absolute right-4 text-text-400 hover:text-text-100">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} className="h-12 rounded-xl">Qidir</Button>
        </div>

        {/* Toolbar */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {appliedQuery && (
              <p className="text-sm text-text-300">
                <span className="font-semibold text-text-100">{data.data?.total ?? 0}</span> natija: &quot;{appliedQuery}&quot;
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-300 transition-colors hover:border-gold-500/30 hover:text-text-100 md:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" /> Filtr
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-300 focus:outline-none focus:border-gold-500/50"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <div className="hidden items-center rounded-lg border border-border-subtle md:flex">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-surface text-gold-500" : "text-text-400 hover:text-text-100"}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-surface text-gold-500" : "text-text-400 hover:text-text-100"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {data.isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 12 }).map((_, idx) => (
              <div key={idx} className="skeleton aspect-[3/4] rounded-2xl" />
            ))}
          </div>
        ) : data.isError ? (
          <div className="rounded-2xl border border-red/20 bg-red/10 p-6 text-center text-sm text-red">
            Qidiruvda xatolik bo'ldi. Qayta urinib ko'ring.
          </div>
        ) : data.data?.items?.length ? (
          <motion.div
            layout
            className={
              viewMode === "grid"
                ? "grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4"
                : "flex flex-col gap-4"
            }
          >
            {data.data.items.map((product, i) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
              >
                <ProductCard
                  product={product}
                  variant={viewMode === "list" ? "list" : "grid"}
                  onBand={setSelected}
                  onOpen={(p) => router.push(`/product/${p.id}`)}
                />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-surface">
              <Search className="h-10 w-10 text-text-400" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-text-100">
              {appliedQuery ? `"${appliedQuery}" bo'yicha natija topilmadi` : "Qidiruvni boshlang"}
            </h3>
            <p className="mb-6 text-sm text-text-400">AI dan so'rab ko'ring — u topib beradi!</p>
            <Button variant="secondary" onClick={() => document.getElementById("ai-trigger")?.click()}>
              🤖 AI dan so'rash
            </Button>
          </div>
        )}
      </div>

      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      <AIChat />
      <BottomNav />
    </main>
  );
}
