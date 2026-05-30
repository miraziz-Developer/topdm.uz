"use client";

import { motion } from "framer-motion";
import { Camera, Loader2, Search, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { ScanBeam } from "@/components/ui/scan-beam";
import { usePhotoSearchNavigate } from "@/hooks/usePhotoSearchNavigate";

const PROMPTS = ["Qora charm kurtka", "Ayollar bahoriy palto", "Klassik kostyum-shim", "Erkaklar jinsi shim"];

export function VisualSearchHero() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const { runPhotoSearch, isSearching } = usePhotoSearchNavigate();

  const runPhotoSearchHandler = useCallback(
    async (file: File) => {
      const reader = new FileReader();
      reader.onload = () => setPreview(String(reader.result ?? ""));
      reader.readAsDataURL(file);
      await runPhotoSearch(file);
    },
    [runPhotoSearch],
  );

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) void runPhotoSearchHandler(file);
  };

  return (
    <section className="relative overflow-hidden px-4 pb-10 pt-28 md:pt-32">
      <div className="absolute inset-0 bg-hero-glow" />
      <motion.div className="relative mx-auto max-w-5xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-4 py-1.5 text-sm text-gold-400">
            <Sparkles className="h-4 w-4" />
            AI Visual Search
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-text-100 md:text-6xl">
            Rasm tashlang,
            <span className="block bg-gradient-gold bg-clip-text text-transparent">bozor topilsin</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-300 md:text-lg">
            Yunusobod, Chorsu va Olmazor bozorlaridagi 50,000+ tovar orasidan AI 30 soniyada eng mos variantni tanlaydi.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={onDrop}
          className="relative overflow-hidden rounded-[28px] border border-border-strong bg-surface/70 p-3 shadow-card backdrop-blur-xl"
        >
          <div className="relative overflow-hidden rounded-[22px] border border-border-subtle bg-canvas/80">
            <ScanBeam active={isSearching} />
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="relative flex h-28 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-gold-500/30 bg-elevated/60 md:h-32 md:w-40">
                {preview ? (
                  <Image src={preview} alt="Yuklangan rasm" fill unoptimized className="object-cover" />
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto h-6 w-6 text-gold-500" />
                    <p className="mt-2 text-xs text-text-400">Rasmni tashlang</p>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <motion.div className="flex items-center gap-3 rounded-2xl border border-border-subtle bg-surface px-4 py-3">
                  <Search className="h-5 w-5 text-gold-500" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && query.trim()) {
                        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
                      }
                    }}
                    placeholder={PROMPTS[promptIndex]}
                    className="w-full bg-transparent text-base text-text-100 outline-none placeholder:text-text-400"
                    onFocus={() => setPromptIndex((value) => (value + 1) % PROMPTS.length)}
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={isSearching}
                    className="rounded-xl border border-border-subtle p-2 text-text-300 transition hover:border-gold-500/40 hover:text-text-100"
                  >
                    {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
                  </button>
                </motion.div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => router.push(`/search?q=${encodeURIComponent(prompt)}`)}
                      className="rounded-full border border-border-subtle px-3 py-1.5 text-xs text-text-300 transition hover:border-gold-500/40 hover:text-text-100"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => query.trim() && router.push(`/search?q=${encodeURIComponent(query.trim())}`)}
                className="rounded-2xl bg-gradient-gold px-6 py-4 text-sm font-semibold text-canvas shadow-gold transition hover:scale-[1.02]"
              >
                Qidirish
              </button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void runPhotoSearchHandler(file);
              event.target.value = "";
            }}
          />
        </motion.div>
      </motion.div>
    </section>
  );
}
