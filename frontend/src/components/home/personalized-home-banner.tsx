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
    <section className="mx-auto max-w-7xl px-2.5 pb-3 pt-1 min-[360px]:px-4 sm:px-6 sm:pb-4">
      <div className={cn("relative rounded-2xl border p-3 min-[360px]:p-4 md:flex md:items-center md:justify-between md:gap-6", tone)}>
        {/* Close button */}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.06] text-ink-500 transition hover:bg-black/10 hover:text-ink-900"
          aria-label="Yopish"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex gap-2.5 pr-7 min-[360px]:gap-3 min-[360px]:pr-8">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/60 min-[360px]:h-11 min-[360px]:w-11">
            <Icon className="h-5 w-5 text-ink-800" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500 min-[360px]:text-xs">
              Siz uchun · {experience.rule_label ?? experience.rule_id}
            </p>
            <h2 className="mt-0.5 text-sm font-bold text-ink-900 min-[360px]:text-base">{banner.title}</h2>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-600 min-[360px]:text-sm">{banner.body}</p>
          </div>
        </div>

        {experience.ctas?.length ? (
          <div className="mt-3 flex flex-wrap gap-2 md:mt-0 md:shrink-0">
            {experience.ctas.map((cta) => (
              <Link
                key={cta.id}
                href={cta.href}
                className={cn(
                  "inline-flex min-w-0 flex-1 items-center justify-center rounded-xl px-3 py-2 text-center text-xs font-semibold transition min-[360px]:flex-none min-[360px]:px-4 min-[360px]:text-sm",
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
