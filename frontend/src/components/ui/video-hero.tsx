"use client";

import { motion } from "framer-motion";
import { Camera } from "lucide-react";
import { useRef } from "react";

import { ScanBeam } from "@/components/ui/scan-beam";
import { usePhotoSearchNavigate } from "@/hooks/usePhotoSearchNavigate";

const HERO_CLIPS = [
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
];

export function VideoHero() {
  const fileRef = useRef<HTMLInputElement>(null);
  const { runPhotoSearch, isSearching } = usePhotoSearchNavigate();

  return (
    <section className="relative h-[78vh] min-h-[560px] overflow-hidden pt-16">
      <div className="absolute inset-0 grid grid-cols-1 md:grid-cols-3">
        {HERO_CLIPS.map((clip, index) => (
          <video key={clip} src={clip} autoPlay muted loop playsInline className="h-full w-full object-cover" style={{ animationDelay: `${index * 0.2}s` }} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/55 to-canvas/20" />
      <ScanBeam active={isSearching} className="rounded-none" />
      <div className="relative z-10 mx-auto flex h-full max-w-5xl flex-col items-center justify-center px-4 text-center">
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl text-4xl font-bold tracking-tight text-ink-900 md:text-6xl"
        >
          Rasmga oling va <span className="bg-gradient-electric bg-clip-text text-transparent">Ippodromdan toping</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-2xl text-base text-ink-500 md:text-lg">
          Chorsu, Yunusobod va Olmazordagi jonli bozor oqimlari ustida AI bir zumda eng yaqin va eng arzon variantni ajratib beradi.
        </motion.p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fileRef.current?.click()}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink-900 px-6 py-3 text-sm font-semibold text-white shadow-hover"
        >
          <Camera className="h-4 w-4" />
          Rasmni yuklash
        </motion.button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            void runPhotoSearch(file);
            event.target.value = "";
          }}
        />
      </div>
    </section>
  );
}
