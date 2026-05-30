"use client";

import { AlertCircle, Loader2, RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

type MapRouteStatusProps = {
  routeLoading: boolean;
  streetRouteLoading: boolean;
  routeError: string | null;
  storesError: string | null;
  storesLoading: boolean;
  markerCount: number;
  onRetryStores?: () => void;
  onRetryRoute?: () => void;
  className?: string;
};

export function MapRouteStatus({
  routeLoading,
  streetRouteLoading,
  routeError,
  storesError,
  storesLoading,
  markerCount,
  onRetryStores,
  onRetryRoute,
  className,
}: MapRouteStatusProps) {
  const busy = routeLoading || streetRouteLoading;

  if (!busy && !routeError && !storesError && !storesLoading && markerCount > 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "pointer-events-auto flex flex-col gap-2 rounded-2xl border border-white/70 bg-white/92 px-3 py-2.5 shadow-lg backdrop-blur-md",
        className,
      )}
    >
      {storesLoading ? (
        <p className="flex items-center gap-2 text-xs font-medium text-ink-600">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-electric-500" />
          Do&apos;konlar yuklanmoqda…
        </p>
      ) : null}

      {!storesLoading && storesError ? (
        <div className="flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{storesError}</p>
            {onRetryStores ? (
              <button
                type="button"
                onClick={onRetryStores}
                className="pointer-events-auto mt-1 inline-flex items-center gap-1 font-bold text-electric-600 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Qayta yuklash
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!storesLoading && !storesError && markerCount === 0 ? (
        <p className="flex items-center gap-2 text-xs font-medium text-ink-600">
          <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          Do&apos;konlar topilmadi. Backend ishlayaptimi?
        </p>
      ) : null}

      {busy ? (
        <p className="flex items-center gap-2 text-xs font-medium text-electric-700">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {streetRouteLoading ? "Xarita yo‘li hisoblanmoqda…" : "Marshrut tuzilmoqda…"}
        </p>
      ) : null}

      {routeError ? (
        <div className="flex items-start gap-2 text-xs text-red-700">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{routeError}</p>
            {onRetryRoute ? (
              <button
                type="button"
                onClick={onRetryRoute}
                className="pointer-events-auto mt-1 inline-flex items-center gap-1 font-bold text-electric-600 hover:underline"
              >
                <RefreshCw className="h-3 w-3" />
                Qayta urinish
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
