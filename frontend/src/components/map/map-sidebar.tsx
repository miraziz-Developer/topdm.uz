"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ExternalLink, Loader2, MapPin, Navigation, Navigation2, Search, Store, Crosshair } from "lucide-react";

import {
  YANDEX_TRANSPORT_MODES,
  type YandexTransportMode,
} from "@/lib/map/yandex-transport-modes";

import { NavigationFollowControl } from "@/components/map/navigation-follow-control";
import { AddressGeocodeSearch } from "@/components/map/address-geocode-search";
import { SearchField } from "@/components/ui/search-field";
import { routeSourceCaption, type RoutePathSource } from "@/lib/map/route-distance";
import { locationDetailsFromMarker } from "@/lib/map/shop-location-display";
import { ShopLocationDetailsCard } from "@/components/map/shop-location-details";
import type { MapShopMarker } from "@/lib/shop-location";
import type { RouteStartMode } from "@/hooks/useIppodromMapPage";
import { cn } from "@/lib/utils";

type MapSidebarProps = {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchBusy: boolean;
  markers: MapShopMarker[];
  selectedMarker: MapShopMarker | null;
  onSelectShop: (marker: MapShopMarker) => void;
  fromNodeId: string;
  onFromChange: (nodeId: string) => void;
  onBuildRoute: () => void;
  routeLoading: boolean;
  streetRouteLoading?: boolean;
  routeDistanceLabel: string | null;
  routePathSource?: RoutePathSource | null;
  streetRouteProvider?: string | null;
  routeStartMode: RouteStartMode;
  onRouteStartModeChange: (mode: RouteStartMode) => void;
  addressQuery: string;
  onAddressQueryChange: (value: string) => void;
  addressLabel: string | null;
  onAddressResolved: (result: { lat: number; lng: number; label: string }) => void;
  onClearAddress?: () => void;
  onRefreshGps: () => void;
  gpsRefreshing: boolean;
  hasGpsFix: boolean;
  gpsError?: string | null;
  manualMapStart?: { lat: number; lng: number } | null;
  onClearMapStart?: () => void;
  routeError?: string | null;
  routeStartHint?: string | null;
  destinationBanner?: string | null;
  routePreviewReady?: boolean;
  autoNavigating?: boolean;
  yandexNavigation?: boolean;
  transportMode?: YandexTransportMode;
  onTransportModeChange?: (mode: YandexTransportMode) => void;
  onStartNavigation?: () => void;
  navigationBusy?: boolean;
  navigationActive?: boolean;
  followUserActive?: boolean;
  onToggleFollowUser?: () => void;
  /** Marshrut tayyor Yandex Maps / Navigator da ochiladi (ichki chizilmaydi). */
  externalYandexNav?: boolean;
  onOpenYandexNav?: () => void;
  shopPageHref?: string | null;
  className?: string;
};

export function MapSidebar({
  searchQuery,
  onSearchChange,
  searchBusy,
  markers,
  selectedMarker,
  onSelectShop,
  fromNodeId,
  onFromChange,
  onBuildRoute,
  routeLoading,
  streetRouteLoading = false,
  routeDistanceLabel,
  routePathSource = null,
  streetRouteProvider = null,
  routeStartMode,
  onRouteStartModeChange,
  addressQuery,
  onAddressQueryChange,
  addressLabel,
  onAddressResolved,
  onClearAddress,
  onRefreshGps,
  gpsRefreshing,
  hasGpsFix,
  gpsError = null,
  manualMapStart,
  onClearMapStart,
  routeError,
  routeStartHint,
  destinationBanner = null,
  routePreviewReady = false,
  autoNavigating = false,
  yandexNavigation = false,
  transportMode = "pedestrian",
  onTransportModeChange,
  onStartNavigation,
  navigationBusy = false,
  navigationActive = false,
  followUserActive = false,
  onToggleFollowUser,
  externalYandexNav = false,
  onOpenYandexNav,
  shopPageHref = null,
  className,
}: MapSidebarProps) {
  const fromBlock = (fromNodeId.replace("entrance-", "").toUpperCase() || "A").charAt(0);
  const routeBusy = routeLoading || streetRouteLoading;
  const normalizedDistanceLabel = routeDistanceLabel
    ? routeDistanceLabel.replace(/-\s*/g, "")
    : null;
  const entranceBlocks = ["A", "B", "C", "D"] as const;

  const startModeTabs: { id: Exclude<RouteStartMode, "stall">; label: string }[] = [
    { id: "entrance", label: "Manzil" },
    { id: "gps", label: "GPS" },
    { id: "address", label: "Joy qidiruv" },
  ];

  return (
    <motion.aside
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "pointer-events-auto flex w-[min(100%,380px)] flex-col gap-4 rounded-3xl border border-white/70 bg-white/82 p-5 shadow-xl backdrop-blur-xl",
        className,
      )}
    >
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-electric-500">Ippodrom xaritasi</p>
        <h1 className="mt-1 text-lg font-bold tracking-tight text-ink-900">Premium do'kon navigatsiyasi</h1>
      </div>

      <SearchField
        variant="rounded"
        placeholder="Do'kon, kiyim, kategoriya..."
        value={searchQuery}
        onChange={(event) => onSearchChange(event.target.value)}
        showPhotoButton={false}
        showVoiceButton={false}
        busy={searchBusy}
        rightSlot={searchBusy ? <Loader2 className="h-4 w-4 animate-spin text-electric-500" /> : <Search className="h-4 w-4 text-ink-500" />}
      />

      <AnimatePresence mode="popLayout">
        {markers.length > 0 && searchQuery.trim().length > 0 ? (
          <motion.ul
            key="results"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-h-40 space-y-1 overflow-y-auto overscroll-contain"
          >
            {markers.slice(0, 8).map((marker) => {
              const active = selectedMarker?.id === marker.id;
              const loc = locationDetailsFromMarker(marker);
              return (
                <li key={marker.id}>
                  <button
                    type="button"
                    onClick={() => onSelectShop(marker)}
                    className={cn(
                      "flex w-full flex-col gap-1.5 rounded-xl px-2 py-2 text-left text-xs transition",
                      active
                        ? "bg-electric-500/12 font-semibold text-electric-600 shadow-[0_0_0_1px_rgba(0,102,255,0.2)]"
                        : "text-ink-700 hover:bg-white/90",
                    )}
                  >
                    <span className="flex items-center gap-2 px-1">
                      <Store className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{marker.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] font-medium text-ink-500">{loc.summary}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        ) : null}
      </AnimatePresence>

      <div className="rounded-2xl border border-neutral-200/50 bg-white/72 p-4 shadow-sm backdrop-blur-sm">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-900">
          <Navigation2 className={`h-4 w-4 ${externalYandexNav ? "text-[#22c55e]" : "text-electric-500"}`} />
          {externalYandexNav ? "Navigatsiya (Yandex)" : "Yo'nalish paneli"}
        </div>

        {externalYandexNav ? (
          <>
            {destinationBanner ? (
              <div className="mb-3 rounded-lg border border-[#1E98FF]/25 bg-[#1E98FF]/8 px-3 py-2">
                <p className="text-[11px] font-semibold text-[#0c4a8a]">{destinationBanner}</p>
                <p className="mt-1 text-[10px] text-ink-600">
                  Barcha do‘konlar xaritada. Marshrut — Yandex Navigator (tayyor, xatosiz).
                </p>
              </div>
            ) : null}

            <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Tanlangan do‘kon</label>
            {selectedMarker ? (
              <div className="mt-1.5 space-y-2">
                <p className="truncate px-0.5 text-xs font-semibold text-ink-800">{selectedMarker.name}</p>
                <ShopLocationDetailsCard location={locationDetailsFromMarker(selectedMarker)} compact />
              </div>
            ) : (
              <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-dashed border-[#1E98FF]/30 bg-[#1E98FF]/5 px-3 py-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1E98FF]" />
                <p className="text-[11px] text-ink-500">Xaritadan yoki qidiruvdan do‘kon tanlang</p>
              </div>
            )}

            <button
              type="button"
              disabled={!selectedMarker}
              onClick={onOpenYandexNav}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#22c55e] py-3 text-xs font-bold text-white shadow-lg shadow-green-600/20 transition hover:bg-[#16a34a] disabled:opacity-50"
            >
              <ExternalLink className="h-4 w-4" />
              Yandex Navigator&apos;da marshrut
            </button>

            {shopPageHref && selectedMarker ? (
              <Link
                href={shopPageHref}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-[#1E98FF]/30 bg-white py-2.5 text-xs font-bold text-[#1E98FF] transition hover:bg-[#1E98FF]/5"
              >
                <Store className="h-4 w-4" />
                Do‘konga kirish
              </Link>
            ) : null}

            <p className="mt-2 text-center text-[10px] text-ink-500">
              Pin ustiga bosing — do‘kon haqida va mahsulotlar
            </p>
          </>
        ) : (
          <>
        <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Boshlanish rejimi</label>
        <div className="mt-1.5 grid grid-cols-3 gap-1">
          {startModeTabs.map((tab) => {
            const active = routeStartMode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onRouteStartModeChange(tab.id)}
                className={cn(
                  "rounded-lg py-1.5 text-[10px] font-bold transition-all duration-200",
                  active
                    ? "bg-electric-500 text-white shadow-md shadow-electric-500/30"
                    : "bg-white/90 text-ink-600 hover:bg-electric-500/10 hover:text-electric-600",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {routeStartMode === "entrance" ? (
          <>
            <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-ink-500">
              Dan — uy, avtoto‘xtash yoki bozor
            </label>
            <div className="mt-1.5 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">
                Zaxira kirish (blok)
              </p>
              <div className="grid grid-cols-4 gap-1">
                {entranceBlocks.map((block) => {
                  const active = fromBlock === block;
                  return (
                    <button
                      key={block}
                      type="button"
                      onClick={() => onFromChange(`entrance-${block}`)}
                      className={cn(
                        "rounded-lg py-1.5 text-[10px] font-bold transition",
                        active
                          ? "bg-electric-500 text-white"
                          : "bg-white text-ink-600 ring-1 ring-neutral-200/80 hover:bg-electric-500/10",
                      )}
                    >
                      {block}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mt-1.5 rounded-lg border border-electric-500/20 bg-electric-500/5 p-2.5">
              <p className="text-[11px] font-medium text-ink-700">
                Xaritada istalgan joyga bosing — yo‘l o‘sha nuqtadan boshlanadi.
              </p>
              <p className="mt-1 text-[10px] text-ink-500">
                {manualMapStart
                  ? `Tanlandi: ${manualMapStart.lat.toFixed(5)}, ${manualMapStart.lng.toFixed(5)}`
                  : `Zaxira: ${fromBlock}-blok kirishi`}
              </p>
              {manualMapStart && onClearMapStart ? (
                <button
                  type="button"
                  onClick={onClearMapStart}
                  className="mt-2 text-[10px] font-bold text-electric-600 hover:underline"
                >
                  Startni tozalash
                </button>
              ) : null}
            </div>
          </>
        ) : null}

        {routeStartMode === "gps" ? (
          <div className="mt-3 space-y-2 rounded-lg border border-electric-500/15 bg-electric-500/5 p-2.5">
            <p className="text-[11px] leading-snug text-ink-600">
              Telefoningizdagi joylashuv. Ruxsat berilgach, «Marshrutni boshlash» bosing.
            </p>
            <button
              type="button"
              onClick={onRefreshGps}
              disabled={gpsRefreshing}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-electric-500 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-electric-600 disabled:opacity-60"
            >
              {gpsRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Crosshair className="h-3.5 w-3.5" />}
              Joylashuvni olish
            </button>
            <p className="text-[10px] text-ink-500">
              {hasGpsFix
                ? "Joylashuv qabul qilindi."
                : "Hali signal yo‘q — «Joylashuvni olish» tugmasini bosing."}
            </p>
            {gpsError ? <p className="text-[10px] font-semibold text-red-600">{gpsError}</p> : null}
          </div>
        ) : null}

        {routeStartMode === "address" ? (
          <div className="mt-3">
            <AddressGeocodeSearch
              value={addressQuery}
              onValueChange={onAddressQueryChange}
              selectedLabel={addressLabel}
              onResolved={onAddressResolved}
              onClear={onClearAddress}
            />
          </div>
        ) : null}

        <div className="my-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-neutral-200/80" />
          <ArrowRight className="h-4 w-4 text-ink-400" />
          <div className="h-px flex-1 bg-neutral-200/80" />
        </div>

        {destinationBanner ? (
          <div className="mb-2 rounded-lg border border-electric-500/25 bg-electric-500/8 px-3 py-2">
            <p className="text-[11px] font-semibold text-electric-700">{destinationBanner}</p>
            <p className="mt-1 text-[10px] text-ink-600">
              Avval do‘kon xaritada ko‘rinadi. Keyin qayerdan ketishingizni tanlang va marshrutni boshlang.
            </p>
          </div>
        ) : null}

        <label className="text-[10px] font-semibold uppercase tracking-wide text-ink-500">Gacha (B nuqta — do‘kon)</label>
        <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-electric-500/40 bg-electric-500/5 px-3 py-2.5 ring-1 ring-electric-500/15">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-snug text-ink-800">{selectedMarker?.name ?? "Manzilni tanlang"}</p>
            {selectedMarker ? (
              <>
                <p className="mt-1 text-[11px] text-ink-500">{selectedMarker.ipadrom || "Ippodrom"}</p>
                <p className="mt-1 inline-flex items-center rounded-md bg-electric-500/10 px-1.5 py-0.5 text-[10px] font-bold text-electric-700">
                  {selectedMarker.pin.block}-blok • rasta {selectedMarker.pin.stall}
                </p>
              </>
            ) : (
              <p className="text-[11px] text-ink-500">Manzil tanlanmagan</p>
            )}
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedMarker || routeBusy}
          onClick={onBuildRoute}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 py-2.5 text-xs font-bold tracking-wide text-white shadow-lg shadow-blue-600/25 transition hover:scale-[1.01] hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {routeBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Navigation2 className="h-4 w-4" />}
          {routePreviewReady ? "Marshrutni yangilash" : "Marshrutni boshlash"}
        </button>

        {autoNavigating && !routePreviewReady ? (
          <p className="mt-2 flex items-center justify-center gap-2 text-center text-[11px] font-medium text-electric-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            GPS va yo‘l hisoblanmoqda…
          </p>
        ) : null}

        {routePreviewReady && yandexNavigation ? (
          <div className="mt-3 space-y-2 rounded-xl border border-[#1E98FF]/20 bg-white/90 p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-ink-500">Yandex navigatsiya</p>
            <div className="grid grid-cols-3 gap-1">
              {YANDEX_TRANSPORT_MODES.map((mode) => {
                const active = transportMode === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    title={mode.label}
                    onClick={() => onTransportModeChange?.(mode.id)}
                    className={cn(
                      "rounded-lg py-2 text-[10px] font-bold transition",
                      active
                        ? "bg-[#1E98FF] text-white"
                        : "bg-slate-100 text-ink-700 hover:bg-[#1E98FF]/10",
                    )}
                  >
                    <span className="block text-sm">{mode.icon}</span>
                    {mode.shortLabel}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={navigationBusy || !selectedMarker}
              onClick={onStartNavigation}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#1E98FF] py-2.5 text-[11px] font-bold text-white shadow-md transition hover:bg-[#1787e8] disabled:opacity-50"
            >
              {navigationBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4" />
              )}
              Navigatsiyani boshlash
            </button>
            {navigationActive && onToggleFollowUser ? (
              <NavigationFollowControl
                active={followUserActive}
                onToggle={onToggleFollowUser}
                className="w-full"
              />
            ) : null}
          </div>
        ) : null}

        {routePreviewReady && !yandexNavigation && navigationActive && onToggleFollowUser ? (
          <NavigationFollowControl
            active={followUserActive}
            onToggle={onToggleFollowUser}
            className="mt-3 w-full"
          />
        ) : null}

        {routeStartHint ? (
          <p
            className={cn(
              "mt-2 text-center text-[10px] font-medium",
              routePathSource === "osm" && routeDistanceLabel
                ? "text-electric-700"
                : "text-amber-800",
            )}
          >
            {routeStartHint}
          </p>
        ) : null}

        {routeError ? (
          <p className="mt-2 text-center text-[10px] font-semibold text-red-600">{routeError}</p>
        ) : null}
          </>
        )}

        {streetRouteLoading && selectedMarker ? (
          <p className="mt-2 text-center text-[10px] font-medium text-ink-500">
            Xarita yo‘li hisoblanmoqda…
          </p>
        ) : null}

        {normalizedDistanceLabel ? (
          <div className="mt-2 space-y-1 rounded-xl border border-electric-500/15 bg-electric-500/5 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold text-electric-600">Masofa: {normalizedDistanceLabel}</p>
            {routePathSource ? (
              <p className="text-[10px] font-medium text-ink-500">
                {routeSourceCaption(routePathSource, streetRouteProvider)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.aside>
  );
}
