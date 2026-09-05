import { Suspense } from "react";

import { IppodromMapLoader } from "@/components/map/ippodrom-map-loader";
import { resolveMapTilerKey } from "@/lib/map/maplibre-styles";

import "./map.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bozorliii Xarita | Ippodrom Navigatsiya",
  description: "Ippodrom bozori ichki navigatsiya — do'konlar, marshrut va qavatlar.",
};

export default function MapPage() {
  const mapTilerKey = resolveMapTilerKey();

  return (
    <main className="ippodrom-map-root">
      <Suspense
        fallback={
          <div className="flex h-[calc(100vh-64px)] min-h-[100dvh] w-full items-center justify-center bg-[#F4F5F7]">
            <p className="text-sm font-medium text-ink-500">Xarita yuklanmoqda…</p>
          </div>
        }
      >
        <IppodromMapLoader mapTilerKey={mapTilerKey} />
      </Suspense>
    </main>
  );
}
