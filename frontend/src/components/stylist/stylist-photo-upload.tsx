"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Camera, Loader2, ScanSearch, Shirt, UserRound, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { fileToDataUrl } from "@/lib/image-data-url";

export type StylistPhotoMode = "look_check" | "personal_style" | "find_similar";

const MODES: Array<{
  id: StylistPhotoMode;
  title: string;
  desc: string;
  icon: typeof Shirt;
  defaultPrompt: string;
}> = [
  {
    id: "look_check",
    title: "Bu look qanday?",
    desc: "Kiyim rasmini yuboring — uslub, rang va yaxshilash bo‘yicha maslahat",
    icon: Shirt,
    defaultPrompt: "Bu look qanday turadi? Nima yaxshilash mumkin?",
  },
  {
    id: "personal_style",
    title: "Menga mos tavsiya",
    desc: "O‘z suratingiz — sizga mos kiyim va kombinatsiya",
    icon: UserRound,
    defaultPrompt: "Mening suratim — menga mos look va kiyim tavsiya qiling.",
  },
  {
    id: "find_similar",
    title: "Katalogda o‘xshashini top",
    desc: "Rasmdagidek mahsulotlarni Ippodrom katalogidan qidirish",
    icon: ScanSearch,
    defaultPrompt: "Rasmdagidek mahsulotlarni katalogdan toping.",
  },
];

type StylistPhotoUploadProps = {
  disabled?: boolean;
  className?: string;
  openSignal?: number;
  onSend: (payload: { mode: StylistPhotoMode; dataUrl: string; text: string }) => void | Promise<void>;
};

export function StylistPhotoUpload({ disabled, className, openSignal = 0, onSend }: StylistPhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<StylistPhotoMode | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (openSignal > 0) setOpen(true);
  }, [openSignal]);

  const pickMode = (mode: StylistPhotoMode) => {
    setPendingMode(mode);
    inputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    if (!file || !pendingMode || loading) return;
    setLoading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const modeConfig = MODES.find((m) => m.id === pendingMode);
      await onSend({
        mode: pendingMode,
        dataUrl,
        text: modeConfig?.defaultPrompt ?? "",
      });
      setOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setPendingMode(null);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled || loading}
        title="Rasm yuborish — stylist tahlili"
        aria-label="Rasm yuborish"
        onClick={() => setOpen(true)}
        className={cn(
          "touch-target flex-shrink-0 rounded-lg p-2 text-text-400 transition-colors hover:bg-elevated hover:text-gold-500 disabled:opacity-50",
          className,
        )}
      >
        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <AnimatePresence>
        {open ? (
          <>
            <motion.button
              type="button"
              aria-label="Yopish"
              className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-labelledby="stylist-photo-title"
              className="fixed inset-x-3 bottom-[calc(var(--app-bottom-nav-h)+env(safe-area-inset-bottom)+0.5rem)] z-[85] mx-auto max-w-md rounded-3xl border border-border-subtle bg-white p-4 shadow-modal sm:inset-x-auto sm:right-4 sm:bottom-24 sm:left-auto md:bottom-8"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p id="stylist-photo-title" className="text-sm font-bold text-ink-900">
                    Rasm yuborish
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">Maqsadingizni tanlang — stylist shunga qarab javob beradi</p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="touch-target rounded-lg p-1 text-ink-500 hover:bg-elevated"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <ul className="space-y-2">
                {MODES.map((mode) => {
                  const Icon = mode.icon;
                  return (
                    <li key={mode.id}>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => pickMode(mode.id)}
                        className="flex w-full items-start gap-3 rounded-2xl border border-border-subtle bg-elevated/50 px-3 py-3 text-left transition hover:border-gold-500/40 hover:bg-white active:scale-[0.99]"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/10 text-gold-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-ink-900">{mode.title}</span>
                          <span className="mt-0.5 block text-xs leading-snug text-ink-500">{mode.desc}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function StylistPhotoPreview({ src, alt }: { src: string; alt?: string }) {
  return (
    <div className="relative mt-2 h-36 w-full max-w-[220px] overflow-hidden rounded-xl border border-gold-500/25 bg-elevated">
      <Image src={src} alt={alt ?? "Yuklangan rasm"} fill unoptimized className="object-cover" />
    </div>
  );
}
