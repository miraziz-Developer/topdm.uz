"use client";

import nextDynamic from "next/dynamic";

const IppodromMapExperience = nextDynamic(
  () => import("@/components/map/ippodrom-map-experience").then((mod) => mod.IppodromMapExperience),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-64px)] min-h-[100dvh] w-full items-center justify-center bg-[#F4F5F7] max-md:min-h-[100dvh]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-full bg-electric-500/20" />
          <p className="text-sm font-medium text-ink-500">Ippodrom xaritasi yuklanmoqda…</p>
        </div>
      </div>
    ),
  },
);

export function IppodromMapLoader({ mapTilerKey }: { mapTilerKey: string }) {
  return <IppodromMapExperience key="map-simple-v2" mapTilerKey={mapTilerKey} />;
}