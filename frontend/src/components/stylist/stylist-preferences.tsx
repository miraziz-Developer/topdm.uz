"use client";

import { useEffect, useState } from "react";

import { useLocale } from "@/i18n/locale-provider";
import { loadStylistProfile, saveStylistProfile } from "@/lib/stylist-profile";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "41", "42", "43", "44"];
const COLORS = ["qora", "oq", "ko'k", "qizil", "yashil", "bej", "kulrang"];

export function StylistPreferences() {
  const { locale } = useLocale();
  const [size, setSize] = useState("");
  const [colors, setColors] = useState<string[]>([]);

  useEffect(() => {
    const p = loadStylistProfile();
    setSize(p.size || "");
    setColors(p.favorite_colors || []);
  }, []);

  useEffect(() => {
    saveStylistProfile({ size: size || undefined, favorite_colors: colors, locale });
  }, [size, colors, locale]);

  const toggleColor = (c: string) => {
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].slice(0, 4)));
  };

  return (
    <div className="rounded-3xl border border-border-subtle bg-white/70 p-5 shadow-elevated backdrop-blur-xl">
      <h2 className="text-sm font-bold uppercase tracking-widest text-ink-800">Mening profilim</h2>
      <p className="mt-1 text-xs text-neutral-600">AI keyingi tavsiyalarda hisobga oladi</p>

      <label className="mt-4 block text-xs font-semibold text-ink-700">O&apos;lcham</label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {SIZES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSize(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
              size === s ? "bg-gold-500/20 text-ink-900 ring-1 ring-gold-500/50" : "bg-surface text-ink-600"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="mt-4 text-xs font-semibold text-ink-700">Sevimli ranglar</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => toggleColor(c)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize transition ${
              colors.includes(c) ? "bg-electric-500/15 text-electric-700 ring-1 ring-electric-500/40" : "bg-surface text-ink-600"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}
