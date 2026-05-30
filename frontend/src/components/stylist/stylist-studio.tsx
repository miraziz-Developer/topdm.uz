"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Clock, MapPin, Sparkles, Star, Wand2 } from "lucide-react";
import Link from "next/link";

import { AIChat } from "@/components/AIChat";
import { StylistPreferences } from "@/components/stylist/stylist-preferences";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { fadeUp } from "@/lib/motion-presets";
import { STYLIST_PROMPT_EVENT } from "@/lib/ai-chat-bus";

const SCENARIOS = [
  { emoji: "💼", title: "Ofis uchrashuvi", hint: "Klassik, qora-ko'k, 500 ming so'mgacha" },
  { emoji: "💒", title: "To'y / tadbir", hint: "Sarpo yoki kechki libos, premium segment" },
  { emoji: "🏃", title: "Sport & kundalik", hint: "Qulay krossovka + sport majmua" },
  { emoji: "👶", title: "Bolalar look", hint: "Maktab formasi yoki 6–12 yosh kostyum" },
  { emoji: "📦", title: "Optom savdo", hint: "10+ dona, eng yaxshi guruh narxi" },
  { emoji: "🌡️", title: "Mavsumiy", hint: "Bahoriy yengil kurtka + shim kombinatsiya" },
];

export function StylistStudio() {
  return (
    <main className="page-shell relative min-h-dvh overflow-x-clip bg-canvas md:pb-12">
      <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-48 h-80 w-80 rounded-full bg-electric-500/12 blur-3xl" />

      <Navigation />

      <div className="page-content-top relative mx-auto max-w-6xl px-4 sm:px-5">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Bosh sahifa
        </Link>

        <motion.div {...fadeUp} className="mb-8 text-center md:mb-10">
          <p className="eyebrow-pill mb-4 inline-flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold-500" />
            Shaxsiy AI Stilist
          </p>
          <h1 className="display-hero text-ink-900">
            30 yillik tajriba —
            <span className="block text-gradient-electric">soniyada sizga mos look</span>
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base font-medium leading-relaxed text-neutral-600">
            Ippodrom va Abu Saxiy katalogidan haqiqiy mahsulotlar. Byudjet, rang, vaziyat — hammasini
            hisobga olib, kombinatsiya + xaritada yo‘l ko‘rsatadi.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-xs backdrop-blur">
              <Star className="h-3.5 w-3.5 text-gold-500" />
              Pro daraja maslahat
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-xs backdrop-blur">
              <Clock className="h-3.5 w-3.5 text-electric-500" />
              ~30 soniyada javob
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink-800 shadow-xs backdrop-blur">
              <MapPin className="h-3.5 w-3.5 text-electric-500" />
              Haqiqiy do‘konlar
            </span>
          </div>
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start">
          <motion.aside {...fadeUp} className="space-y-4 lg:sticky lg:top-28">
            <StylistPreferences />
            <div className="rounded-3xl border border-border-subtle bg-white/70 p-5 shadow-elevated backdrop-blur-xl">
              <div className="mb-4 flex items-center gap-2">
                <Wand2 className="h-5 w-5 text-gold-500" />
                <h2 className="text-sm font-bold uppercase tracking-widest text-ink-800">
                  Tayyor stsenariylar
                </h2>
              </div>
              <ul className="space-y-2">
                {SCENARIOS.map((item) => (
                  <li key={item.title}>
                    <button
                      type="button"
                      className="group w-full rounded-2xl border border-transparent bg-elevated/80 px-4 py-3 text-left transition hover:border-gold-500/30 hover:bg-white"
                      onClick={() => {
                        window.dispatchEvent(
                          new CustomEvent(STYLIST_PROMPT_EVENT, {
                            detail: `${item.title}: ${item.hint}`,
                          }),
                        );
                      }}
                    >
                      <span className="text-lg">{item.emoji}</span>
                      <p className="mt-1 text-sm font-semibold text-ink-900">{item.title}</p>
                      <p className="text-xs text-ink-500 group-hover:text-ink-700">{item.hint}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-center text-[11px] leading-relaxed text-ink-500 lg:text-left">
              Kamera tugmasi yoki «Rasm yuborish» — look bahosi, shaxsiy tavsiya yoki katalogdan o‘xshash qidiruv.
            </p>
          </motion.aside>

          <motion.div {...fadeUp} className="min-w-0">
            <AIChat variant="studio" />
          </motion.div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}
