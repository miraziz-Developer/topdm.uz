"use client";

import { MessageCircle, Shield, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { useT } from "@/i18n/locale-provider";
import type { HomeMessageKey } from "@/i18n/home-messages";
import { cn } from "@/lib/utils";

type TrustAnchor = {
  icon: typeof Shield;
  titleKey: HomeMessageKey;
  descKey: HomeMessageKey;
  stylistCard?: boolean;
};

const ANCHORS: TrustAnchor[] = [
  {
    icon: Shield,
    titleKey: "home.trust.pricing.title",
    descKey: "home.trust.pricing.desc",
  },
  {
    icon: MessageCircle,
    titleKey: "home.trust.direct.title",
    descKey: "home.trust.direct.desc",
  },
  {
    icon: Sparkles,
    titleKey: "home.trust.stylist.title",
    descKey: "home.trust.stylist.desc",
    stylistCard: true,
  },
];

const cardBase =
  "group relative overflow-hidden rounded-2xl border border-neutral-200/50 bg-white/40 p-6 shadow-[0_20px_50px_rgba(0,0,0,0.02)] backdrop-blur-xl transition-all duration-500 ease-out hover:-translate-y-1 hover:border-neutral-300 hover:bg-white/80 hover:shadow-[0_30px_60px_rgba(0,0,0,0.06)]";

export function PremiumTrustAnchors() {
  const t = useT();
  const router = useRouter();

  return (
    <div
      className="mx-auto mb-16 grid max-w-5xl grid-cols-1 gap-6 animate-fade-in md:grid-cols-3 md:items-stretch"
      role="list"
      aria-label={t("home.trust.aria")}
    >
      {ANCHORS.map((anchor) => {
        const Icon = anchor.icon;
        const interactive = Boolean(anchor.stylistCard);
        const goStylist = () => router.push("/stylist");

        return (
          <article
            key={anchor.titleKey}
            role="listitem"
            tabIndex={interactive ? 0 : undefined}
            onClick={interactive ? goStylist : undefined}
            onKeyDown={(event) => {
              if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
              event.preventDefault();
              goStylist();
            }}
            className={cn(
              cardBase,
              "flex h-full flex-col",
              interactive &&
                "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric-500",
              interactive && "ring-1 ring-transparent hover:ring-gold-500/25",
            )}
          >
            <div className="relative flex flex-1 flex-col">
              <span
                className={cn(
                  "mb-3 inline-block rounded-xl p-2.5 transition-colors",
                  interactive
                    ? "bg-gold-500/10 text-gold-600 group-hover:bg-gold-500/15"
                    : "bg-blue-50/80 text-blue-600 group-hover:bg-blue-50",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mb-2 text-base font-semibold tracking-tight text-neutral-900">
                {t(anchor.titleKey)}
              </h3>
              <p className="text-xs font-medium leading-relaxed text-neutral-500 md:text-sm">
                {t(anchor.descKey)}
              </p>
              {interactive ? (
                <p className="mt-auto pt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-widest text-gold-600 transition group-hover:gap-2">
                  {t("home.trust.stylist.cta")}
                </p>
              ) : (
                <span className="mt-auto block min-h-[1.25rem]" aria-hidden />
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
