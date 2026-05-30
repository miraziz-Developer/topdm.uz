"use client";

import Link from "next/link";
import { MapPin, Package, Search, Sparkles, Store, User, X } from "lucide-react";
import { useState } from "react";

import type { HomeExperience } from "@/lib/api";
import { cn } from "@/lib/utils";

const TONE_STYLES: Record<string, string> = {
  electric: "border-electric-500/25 bg-electric-500/10",
  gold: "border-gold-500/25 bg-gold-500/10",
  indigo: "border-indigo-500/25 bg-indigo-500/10",
  neutral: "border-border-subtle bg-surface",
};

const ICONS: Record<string, typeof Package> = {
  package: Package,
  sparkles: Sparkles,
  store: Store,
  user: User,
  search: Search,
  map: MapPin,
};

type Props = {
  experience: HomeExperience | null;
};

export function PersonalizedHomeBanner({ experience }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!experience?.banner || dismissed) return null;

  const banner = experience.banner;
  const tone = TONE_STYLES[banner.tone] ?? TONE_STYLES.indigo;
  const Icon = ICONS[banner.icon ?? "search"] ?? Search;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 sm:px-5">
      <div className={cn("relative rounded-2xl border p-4 md:flex md:items-center md:justify-between md:gap-6", tone)}>
        {/* Close button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-ink-500 transition hover:bg-black/10 hover:text-ink-900"
          aria-label="Yopish"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex gap-3 pr-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/60">
            <Icon className="h-5 w-5 text-ink-800" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
              Siz uchun · {experience.rule_label ?? experience.rule_id}
            </p>
            <h2 className="mt-0.5 text-base font-bold text-ink-900">{banner.title}</h2>
            <p className="mt-0.5 text-sm text-ink-600">{banner.body}</p>
          </div>
        </div>

        {experience.ctas?.length ? (
          <div className="mt-3 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
            {experience.ctas.map((cta) => (
              <Link
                key={cta.id}
                href={cta.href}
                className={cn(
                  "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold transition",
                  cta.variant === "primary"
                    ? "bg-ink-900 text-white hover:bg-ink-800"
                    : "border border-border-subtle bg-white text-ink-800 hover:bg-canvas",
                )}
              >
                {cta.label}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
