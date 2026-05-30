"use client";

import type { ReactNode } from "react";

import type { HomeExperience } from "@/lib/api";

type SectionKey =
  | "banner"
  | "reels"
  | "visual_search"
  | "toolbar"
  | "categories"
  | "banners"
  | "stories"
  | "spotlight"
  | "products";

type Props = {
  experience: HomeExperience | null;
  sections: Record<SectionKey, ReactNode>;
};

/**
 * Tartib: Reels strip yuqorida — darhol ko'rinadi.
 * Filter → Category → Products → Banners → Spotlight
 */
const FIXED_ORDER: SectionKey[] = [
  "banner",
  "reels",          // TikTok-style video strip — darhol ko'rinadi
  "visual_search",
  "stories",
  "toolbar",
  "categories",
  "products",
  "banners",
  "spotlight",
];

export function HomeExperienceLayout({ sections }: Props) {
  return (
    <div className="pt-14 sm:pt-16">
      {FIXED_ORDER.map((key) =>
        sections[key] ? (
          <div key={key} data-section={key}>
            {sections[key]}
          </div>
        ) : null,
      )}
    </div>
  );
}
