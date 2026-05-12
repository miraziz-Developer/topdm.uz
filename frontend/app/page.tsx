"use client";

import { motion } from "framer-motion";
import { Search, Sparkles, Camera, ArrowRight, Zap, CheckCircle2, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AIChat } from "@/components/AIChat";
import { BandQilishModal } from "@/components/BandQilishModal";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import type { Product } from "@/types";

const categories = [
  { name: "Kiyim", icon: "👔", color: "from-blue-500/20 to-blue-500/5", count: "2,340+" },
  { name: "Elektronika", icon: "📱", color: "from-purple-500/20 to-purple-500/5", count: "890+" },
  { name: "Kosmetika", icon: "💄", color: "from-pink-500/20 to-pink-500/5", count: "1,200+" },
  { name: "Oziq-ovqat", icon: "🥗", color: "from-green-500/20 to-green-500/5", count: "560+" },
  { name: "Uy jihozlari", icon: "🛋️", color: "from-orange-500/20 to-orange-500/5", count: "430+" },
  { name: "Sport", icon: "⚽", color: "from-red-500/20 to-red-500/5", count: "320+" },
];

export default function HomePage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const { data, isLoading, isError } = useProducts({ limit: 8, page: 1 });
  
  const placeholders = useMemo(() => ["Qora charm kurtka...", "iPhone 15 Pro Max...", "Maktab uchun ryukzak..."], []);
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhIdx((p) => (p + 1) % placeholders.length), 2000);
    return () => clearInterval(id);
  }, [placeholders.length]);

  return (
    <main className="min-h-screen bg-canvas pb-20 md:pb-0">
      <Navigation />
      
      {/* HERO SECTION */}
      <section className="relative flex min-h-[85vh] flex-col items-center justify-center overflow-hidden px-4">
        <div className="absolute inset-0 bg-hero-glow opacity-50" />
        
        {/* Floating particles (simplified) */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute left-[10%] top-[20%] h-2 w-2 animate-pulse-gold rounded-full bg-gold-500/50" />
          <div className="absolute right-[20%] top-[30%] h-3 w-3 animate-float rounded-full bg-gold-500/30" style={{ animationDelay: "1s" }} />
          <div className="absolute bottom-[20%] left-[30%] h-1.5 w-1.5 animate-pulse-gold rounded-full bg-gold-500/40" style={{ animationDelay: "2s" }} />
        </div>

        <div className="relative z-10 flex w-full max-w-4xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-sm font-medium text-gold-400 backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4" />
            <span>O'zbekistonda birinchi AI marketpleys</span>
          </motion.div>

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mb-6 text-5xl font-bold leading-tight tracking-tight text-text-100 md:text-7xl"
          >
            Toshkent bozorlarini <br />
            <span className="bg-gradient-gold bg-clip-text text-transparent">AI bilan toping</span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mb-10 max-w-2xl text-lg text-text-300 md:text-xl"
          >
            2,000+ do'kon • 50,000+ tovar • Bir qidiruvda
          </motion.p>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="relative w-full max-w-2xl"
          >
            <div className="group relative flex items-center rounded-full border border-border-strong bg-surface/50 p-2 shadow-card backdrop-blur-md transition-all focus-within:border-gold-500 focus-within:shadow-gold focus-within:bg-surface hover:border-border-gold">
              <div className="ml-3 text-text-400 group-focus-within:text-gold-500">
                <Search className="h-5 w-5" />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={placeholders[phIdx]}
                className="w-full bg-transparent px-4 py-3 text-text-100 placeholder:text-text-400 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') router.push(`/search?q=${encodeURIComponent(query)}`)
                }}
              />
              <button className="mr-2 rounded-full p-2 text-text-400 transition-colors hover:bg-elevated hover:text-text-100">
                <Camera className="h-5 w-5" />
              </button>
              <Button 
                onClick={() => router.push(`/search?q=${encodeURIComponent(query)}`)}
                className="rounded-full px-8"
              >
                Qidirish
              </Button>
            </div>
            
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["👔 Kiyim", "📱 iPhone", "💄 Atir"].map((tag) => (
                <button 
                  key={tag}
                  onClick={() => router.push(`/search?q=${encodeURIComponent(tag.replace(/[^a-zA-Z ]/g, "").trim())}`)}
                  className="rounded-full border border-border-subtle bg-surface/50 px-4 py-1.5 text-sm text-text-300 transition-colors hover:border-gold-500/50 hover:text-text-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* STATS BANNER */}
      <section className="border-y border-border-subtle bg-surface/30 backdrop-blur-sm py-8">
        <div className="mx-auto flex max-w-5xl items-center justify-around px-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-text-100">2,400+</div>
            <div className="text-sm font-medium text-text-400">Do'kon</div>
          </div>
          <div className="h-10 w-px bg-border-strong" />
          <div className="text-center">
            <div className="text-3xl font-bold text-text-100">50,000+</div>
            <div className="text-sm font-medium text-text-400">Tovar</div>
          </div>
          <div className="h-10 w-px bg-border-strong" />
          <div className="text-center">
            <div className="text-3xl font-bold text-gold-500 flex items-center justify-center gap-1">
              <Zap className="h-6 w-6" /> 30 soniya
            </div>
            <div className="text-sm font-medium text-text-400">Qidiruv vaqti</div>
          </div>
        </div>
      </section>

      {/* MAIN CONTENT */}
      <div className="mx-auto max-w-6xl space-y-24 px-4 py-20">
        
        {/* KATEGORIYALAR */}
        <section>
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-text-100 md:text-3xl">Kategoriyalar</h2>
            <button className="group flex items-center text-sm font-medium text-text-300 transition-colors hover:text-gold-500">
              Hammasi <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {categories.map((item, i) => (
              <motion.button
                key={item.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                onClick={() => router.push(`/search?category=${encodeURIComponent(item.name)}`)}
                className="group relative overflow-hidden rounded-2xl border border-border-subtle bg-surface p-6 text-left transition-all hover:-translate-y-1 hover:border-gold-500/50 hover:shadow-gold"
              >
                <div className={`absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity group-hover:opacity-100 ${item.color}`} />
                <div className="relative z-10">
                  <div className="mb-4 text-4xl">{item.icon}</div>
                  <h3 className="font-semibold text-text-100">{item.name}</h3>
                  <p className="price-mono mt-1 text-sm text-text-400">{item.count}</p>
                </div>
              </motion.button>
            ))}
          </div>
        </section>

        {/* TREND TOVARLAR */}
        <section>
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-text-100 md:text-3xl">Trend tovarlar</h2>
              <span className="flex items-center gap-1 rounded-full bg-gold-500/20 px-2.5 py-1 text-xs font-semibold text-gold-400">
                <TrendingUp className="h-3 w-3" /> AI Tavsiyasi
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
              ))}
            </div>
          ) : isError ? (
            <div className="rounded-2xl border border-red/20 bg-red/10 p-6 text-center text-red">
              Tovarlarni yuklab bo'lmadi. Keyinroq urinib ko'ring.
            </div>
          ) : data?.items?.length ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {data.items.slice(0, 8).map((product, i) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                >
                  <ProductCard
                    product={product}
                    onBand={setSelected}
                    onOpen={(p) => router.push(`/product/${p.id}`)}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border-default bg-surface p-8 text-center text-text-300">
              Hozircha tovarlar topilmadi.
            </div>
          )}
        </section>

        {/* AI FEATURE (UNIQUE) */}
        <section className="relative overflow-hidden rounded-3xl border border-gold-500/20 bg-surface px-6 py-12 md:px-12 md:py-20 lg:py-24">
          <div className="absolute inset-0 bg-hero-glow opacity-30" />
          <div className="relative z-10 grid gap-12 lg:grid-cols-2 lg:items-center">
            <div className="space-y-8">
              <h2 className="text-3xl font-bold leading-tight text-text-100 md:text-5xl">
                Bozorni <span className="bg-gradient-gold bg-clip-text text-transparent">AI bilan</span> qidiring
              </h2>
              <div className="space-y-4">
                {[
                  "Rasmni yuboring, o'xshash tovarlarni topamiz",
                  "Byudjetingizga moslashtirib beramiz",
                  "Kechki ovqat yoki maktab uchun 'Look' taklif qilamiz",
                  "Barcha do'konlar bazasida bir zumda izlaymiz"
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3 text-text-200">
                    <CheckCircle2 className="h-5 w-5 text-gold-500" />
                    <span className="text-lg">{feature}</span>
                  </div>
                ))}
              </div>
              <Button size="lg" onClick={() => document.getElementById("ai-trigger")?.click()}>
                AI Chatni boshlash
              </Button>
            </div>
            
            <div className="relative mx-auto w-full max-w-sm">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-gold opacity-10 blur-2xl" />
              <div className="relative flex h-[400px] flex-col overflow-hidden rounded-2xl border border-border-strong bg-canvas shadow-2xl">
                <div className="border-b border-border-strong bg-surface p-4 text-center font-semibold">
                  🤖 Bozor AI
                </div>
                <div className="flex-1 space-y-4 p-4">
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-surface" />
                    <div className="rounded-2xl rounded-tl-sm bg-surface p-3 text-sm text-text-200 shadow-sm">
                      Salom! Men Bozor AI. Nima topmoqchisiz?
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <div className="rounded-2xl rounded-tr-sm border border-gold-500/30 bg-gold-500/10 p-3 text-sm text-text-100 shadow-sm">
                      Maktab kechasi uchun italyancha look kerak
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-8 w-8 rounded-full bg-surface" />
                    <div className="space-y-2 rounded-2xl rounded-tl-sm bg-surface p-3 text-sm text-text-200 shadow-sm">
                      <p>Mana, sizga ajoyib look topdim:</p>
                      <div className="h-32 rounded-lg bg-elevated" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

      <BandQilishModal product={selected} isOpen={Boolean(selected)} onClose={() => setSelected(null)} />
      
      {/* Invisible trigger to click via UI */}
      <button id="ai-trigger" className="hidden" />
      
      <AIChat />
      <BottomNav />
    </main>
  );
}
