"use client";

import { motion } from "framer-motion";
import { Camera, Loader2, Sparkles } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState } from "react";

import { useT } from "@/i18n/locale-provider";
import { LaserScanOverlay } from "@/components/ui/laser-scan-overlay";
import { ScanBeam } from "@/components/ui/scan-beam";
import { SearchField } from "@/components/ui/search-field";
import { usePhotoSearchNavigate } from "@/hooks/usePhotoSearchNavigate";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { triggerHaptic } from "@/lib/haptics";
import { fadeUp, scaleIn } from "@/lib/motion-presets";
import { cn } from "@/lib/utils";

const PLACEHOLDER_PROMPTS = [
  "Qora charm kurtka",
  "Ayollar bahoriy palto",
  "Klassik kostyum-shim",
  "Bolalar sport kostyumi",
];

export function AiVisualSearch() {
  const t = useT();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [promptIndex, setPromptIndex] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const { runPhotoSearch, isSearching, error } = usePhotoSearchNavigate();
  const { listening, startListening } = useVoiceSearch((transcript) => {
    setQuery(transcript);
    router.push(`/search?q=${encodeURIComponent(transcript)}`);
  });

  const ingestActive = isSearching || Boolean(preview);

  const runPhotoSearchHandler = useCallback(
    async (file: File) => {
      triggerHaptic();
      setPreview(URL.createObjectURL(file));
      await runPhotoSearch(file);
    },
    [runPhotoSearch],
  );

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragOver(false);
    }
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void runPhotoSearchHandler(file);
  };

  const submitText = () => {
    if (!query.trim()) return;
    triggerHaptic();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <section className="relative overflow-x-clip bg-canvas px-4 pb-4 pt-6 sm:px-5 sm:pt-8">
      <motion.div className="absolute inset-0 bg-hero-glow" />
      <motion.div {...fadeUp} className="relative mx-auto max-w-5xl min-w-0">
        <div className="mb-10 text-center">
          <p className="eyebrow-pill mb-4 inline-flex items-center gap-2 transition-transform duration-300 hover:scale-[1.02]">
            <Sparkles className="h-4 w-4 text-electric-500" />
            {t("home.hero.eyebrow")}
          </p>
          <h1 className="display-hero text-ink-900">
            {t("home.hero.titleLine1")}
            <span className="block text-gradient-electric">{t("home.hero.titleLine2")}</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed tracking-wide text-neutral-500 md:text-lg">
            {t("home.hero.subtitle")}
          </p>
        </div>

        <motion.div
          {...scaleIn}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={cn(
            "relative overflow-hidden rounded-[28px] p-3 transition-all duration-300",
            "glass-panel-strong shadow-elevated",
            dragOver && "shadow-[0_0_28px_rgba(0,102,255,0.35)] ring-2 ring-electric-500/40",
            ingestActive && !dragOver && "shadow-[0_0_20px_rgba(0,102,255,0.22)] ring-1 ring-electric-500/30",
            !dragOver && !ingestActive && "ring-1 ring-black/[0.04]",
          )}
        >
          <div className="relative overflow-hidden rounded-[22px] border border-border-subtle bg-canvas/80">
            <ScanBeam active={isSearching} variant="electric" />
            <div className="flex flex-col gap-3 p-4 md:flex-row md:items-stretch">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={isSearching}
                onDragOver={onDragOver}
                onDrop={onDrop}
                className={cn(
                  "relative flex h-36 w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 md:h-auto md:w-48",
                  "hover:scale-[1.02] active:scale-[0.98]",
                  dragOver
                    ? "scale-[1.01] border-electric-500 bg-electric-500/10 shadow-[0_0_25px_rgba(0,102,255,0.4)]"
                    : "border-electric-500/30 bg-elevated/60 hover:border-electric-500/50 hover:bg-electric-500/5",
                )}
              >
                {preview ? (
                  <>
                    <Image src={preview} alt="Yuklangan rasm" fill unoptimized className="object-cover" />
                    <LaserScanOverlay active />
                    {isSearching ? <ScanBeam active variant="electric" className="rounded-2xl" /> : null}
                  </>
                ) : isSearching ? (
                  <div className="text-center">
                    <Loader2 className="mx-auto h-7 w-7 animate-spin text-electric-500" />
                    <p className="mt-2 text-xs font-medium text-electric-500">AI tahlil qilmoqda…</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="mx-auto h-7 w-7 text-electric-500" />
                    <p className="mt-2 text-xs font-semibold text-ink-900">{t("home.visual.dragHint")}</p>
                    <p className="mt-1 text-[10px] text-gray-600">{t("home.visual.tapHint")}</p>
                  </div>
                )}
              </button>
              <div className="flex flex-1 flex-col justify-center space-y-3">
                <SearchField
                  variant="hero"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onSubmit={submitText}
                  onVoice={startListening}
                  listening={listening}
                  showPhotoButton={false}
                  showSubmitButton
                  placeholder={PLACEHOLDER_PROMPTS[promptIndex]}
                  onFocus={() => setPromptIndex((value) => (value + 1) % PLACEHOLDER_PROMPTS.length)}
                />
                <p className="text-center text-[11px] text-ink-500 md:text-left">
                  Matn, ovoz yoki rasm — barchasi bir joyda. Faqat kiyim-kechak katalogi.
                </p>
              </div>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm font-medium text-red">{error}</p> : null}
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
