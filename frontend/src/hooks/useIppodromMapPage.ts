"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  getIndoorMarketMap,
  getIndoorRoute,
  getIndoorRouteFromCoordinates,
  postOrderApproachPing,
  getMapStores,
  getShopProducts,
  searchProducts,
} from "@/lib/api";
import type { MapStoresResponse } from "@/lib/map-stores";
import { cacheIndoorMap, readCachedIndoorMap } from "@/lib/indoor-map/offline-cache";
import { indoorMapResponseToPlan } from "@/lib/indoor-map/api-plan";
import { getMarketPlan } from "@/lib/indoor-map/markets";
import {
  applyMapDisplayOffset,
  isInsideIppodromGeofence,
  isInsideIppodromGpsAcceptZone,
  stripMapDisplayOffset,
  type GeoLatLng,
} from "@/lib/geo/market-geo";
import { fetchWalkingRoutePolyline } from "@/lib/map/fetch-walking-route";
import { resolveRouteStartWgs84 } from "@/lib/map/resolve-route-start";
import { isYandexMapsApiEnabled, isYandexMapsPreferred } from "@/lib/map/yandex-maps-loader";
import {
  formatRouteDistanceLabel,
  pathLengthMeters,
  type RoutePathSource,
} from "@/lib/map/route-distance";
import {
  buildAnchoredRoutePath,
  finalizeStreetRoutePath,
  resolveRouteAnchors,
  simplifyRoutePath,
} from "@/lib/map/route-geometry";
import type { IndoorMarketPlan, IndoorRoute } from "@/lib/indoor-map/types";
import { shouldAutoNavigateFromMapSource } from "@/lib/map/map-auto-navigate";
import { sanitizeUserGps } from "@/stores/location-store";
import { isSimpleMapMode } from "@/lib/map/simple-map-mode";
import {
  mapStoresToMarkers,
  resolveFocusMarkerFromQuery,
  type MapStoreRecord,
} from "@/lib/map-stores";
import { entranceMapPoint, normalizeStallSlot, stallGraphNodeId, type MapShopMarker } from "@/lib/shop-location";
import { triggerHaptic } from "@/lib/haptics";
import { useLocationStore } from "@/stores/location-store";
import type { Product } from "@/types";

export type RouteStartMode = "entrance" | "gps" | "stall" | "address";

export type MapFocusParams = {
  merchantId?: string | null;
  shopSlug?: string | null;
  block?: string | null;
  stall?: string | null;
  lat?: number | null;
  lng?: number | null;
  focus?: boolean;
  /** order | product | search — do‘kon avval ko‘rsatiladi, marshrut avtomatik emas */
  source?: string | null;
  orderId?: string | null;
};

export type ShopPopupData = {
  shop: MapShopMarker;
  vendorTag: string;
  topProducts: Product[];
  loading: boolean;
};

function resolveOsmEndpointsForStreetRoute(args: {
  routeStartMode: RouteStartMode;
  route: IndoorRoute | null;
  selectedMarker: MapShopMarker;
  anchorMarkers: MapShopMarker[];
  fromNodeId: string;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  manualMapStart: { lat: number; lng: number } | null;
}): { from: GeoLatLng; to: GeoLatLng } | null {
  const toDisplay = { lat: args.selectedMarker.lat, lng: args.selectedMarker.lng };
  const toOsm = stripMapDisplayOffset(toDisplay);

  if (args.routeStartMode === "stall") return null;

  const start = resolveRouteStartWgs84({
    routeStartMode: args.routeStartMode,
    userLat: args.userLat,
    userLng: args.userLng,
    manualMapStart: args.manualMapStart,
  });
  if (start) {
    return { from: start, to: toOsm };
  }

  if (args.routeStartMode === "gps" && args.route?.originGps) {
    return { from: stripMapDisplayOffset(args.route.originGps), to: toOsm };
  }

  if (args.routeStartMode === "entrance") {
    if (args.route?.originGps) {
      return { from: stripMapDisplayOffset(args.route.originGps), to: toOsm };
    }
    const anchors = resolveRouteAnchors(args.anchorMarkers, args.selectedMarker, args.fromNodeId);
    if (!anchors.start) return null;
    return { from: stripMapDisplayOffset(anchors.start), to: toOsm };
  }

  return null;
}

function resolveIndoorRouteStartWgs84(args: {
  routeStartMode: RouteStartMode;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  manualMapStart: { lat: number; lng: number } | null;
}): GeoLatLng | null {
  if (args.routeStartMode === "entrance" && args.manualMapStart) {
    return stripMapDisplayOffset(args.manualMapStart);
  }
  if (
    args.routeStartMode === "gps" &&
    args.userLat != null &&
    args.userLng != null &&
    Number.isFinite(args.userLat) &&
    Number.isFinite(args.userLng)
  ) {
    return { lat: args.userLat, lng: args.userLng };
  }
  if (args.routeStartMode === "address" && args.manualMapStart) {
    return stripMapDisplayOffset(args.manualMapStart);
  }
  return null;
}

function isWgsInsideBazaar(lat: number, lng: number): boolean {
  return isInsideIppodromGeofence(lat, lng) || isInsideIppodromGpsAcceptZone(lat, lng);
}

/** Start nuqta bozor ichida yoki yo‘q (faqat blok kirishi). */
function isIndoorStartInsideBazaar(args: {
  routeStartMode: RouteStartMode;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  manualMapStart: { lat: number; lng: number } | null;
}): boolean {
  if (args.routeStartMode === "entrance" && args.manualMapStart) {
    const s = stripMapDisplayOffset(args.manualMapStart);
    return isWgsInsideBazaar(s.lat, s.lng);
  }
  const start = resolveIndoorRouteStartWgs84(args);
  if (!start) return false;
  return isWgsInsideBazaar(start.lat, start.lng);
}

/** Ippodrom ichida — rasta koridorlari; tashqaridagi start — OSM ko‘cha yo‘li. */
function shouldUseIndoorBazaarRoute(args: {
  routeStartMode: RouteStartMode;
  goalMarker: MapShopMarker;
  userLat: number | null | undefined;
  userLng: number | null | undefined;
  manualMapStart: { lat: number; lng: number } | null;
}): boolean {
  const goal = stripMapDisplayOffset({ lat: args.goalMarker.lat, lng: args.goalMarker.lng });
  if (!isInsideIppodromGeofence(goal.lat, goal.lng)) return false;

  if (args.routeStartMode === "stall") return true;
  if (args.routeStartMode === "entrance") {
    if (!args.manualMapStart) return true;
    return isIndoorStartInsideBazaar(args);
  }

  return isIndoorStartInsideBazaar(args);
}

function mergeFeatureCoordinates(payload: MapStoresResponse): MapStoreRecord[] {
  const byId = new Map(
    (payload.features ?? [])
      .filter((feature) => feature.geometry?.type === "Point")
      .map((feature) => {
        const [lng, lat] = feature.geometry.coordinates ?? [NaN, NaN];
        return [feature.id, { lat, lng }] as const;
      }),
  );

  return (payload.stores ?? []).map((store) => {
    const geo = byId.get(store.id);
    if (!geo) return store;
    if (!Number.isFinite(geo.lat) || !Number.isFinite(geo.lng)) return store;
    if (Math.abs(geo.lat) < 1 || Math.abs(geo.lng) < 1) return store;
    return {
      ...store,
      latitude: geo.lat,
      longitude: geo.lng,
    };
  });
}

export function useIppodromMapPage(focusParams?: MapFocusParams, marketSlug = "ippodrom") {
  const [plan, setPlan] = useState<IndoorMarketPlan>(() => getMarketPlan(marketSlug));
  const [level, setLevel] = useState(1);
  const [mapStores, setMapStores] = useState<MapStoreRecord[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchBusy, setSearchBusy] = useState(false);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [fromNodeId, setFromNodeId] = useState<string | null>(null);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [streetRoutePath, setStreetRoutePath] = useState<GeoLatLng[] | null>(null);
  const [streetRouteDistanceM, setStreetRouteDistanceM] = useState<number | null>(null);
  const [streetRouteProvider, setStreetRouteProvider] = useState<string | null>(null);
  const [routePathSource, setRoutePathSource] = useState<RoutePathSource | null>(null);
  const [streetRouteLoading, setStreetRouteLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [searchMatchIds, setSearchMatchIds] = useState<Set<string> | null>(null);
  const streetRouteAbortRef = useRef<AbortController | null>(null);
  const routeRequestSeqRef = useRef(0);
  const [popup, setPopup] = useState<ShopPopupData | null>(null);

  const [routeStartMode, setRouteStartMode] = useState<RouteStartMode>(() =>
    shouldAutoNavigateFromMapSource(focusParams?.source) ? "gps" : "entrance",
  );
  const [manualStallBlock, setManualStallBlock] = useState<"A" | "B" | "C" | "D">("A");
  const [manualStallInput, setManualStallInput] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
  const [addressLabel, setAddressLabel] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [manualMapStart, setManualMapStart] = useState<{ lat: number; lng: number } | null>(null);

  const currentBlock = useLocationStore((s) => s.currentBlock);
  const userLat = useLocationStore((s) => s.userLat);
  const userLng = useLocationStore((s) => s.userLng);
  const userAccuracyM = useLocationStore((s) => s.userAccuracyM);
  const setCurrentBlock = useLocationStore((s) => s.setCurrentBlock);
  const setUserGps = useLocationStore((s) => s.setUserGps);
  const patchUserGps = useLocationStore((s) => s.patchUserGps);
  const setUseGpsForRoute = useLocationStore((s) => s.setUseGpsForRoute);

  const markers = useMemo(() => {
    if (mapStores.length) return mapStoresToMarkers(mapStores);
    return [];
  }, [mapStores]);

  const levelPlan = useMemo(() => plan.levels.find((l) => l.level === level) ?? plan.levels[0], [plan, level]);

  const filteredMarkers = useMemo(() => {
    const floorTag = level === 2 ? "2" : "1";
    let list = isSimpleMapMode()
      ? markers
      : markers.filter((m) => m.floor.startsWith(floorTag));

    const q = searchQuery.trim().toLowerCase();
    if (q.length >= 2 && searchMatchIds?.size) {
      const matched = list.filter((m) => searchMatchIds.has(m.id));
      const rest = list.filter((m) => !searchMatchIds.has(m.id));
      list = [...matched, ...rest];
    }

    if (q) {
      list = list.filter((marker) => {
        const hay =
          `${marker.name} ${marker.pin.block} ${marker.pin.stall} ${marker.pin.label} ${marker.floor} ${marker.locationComment ?? ""} ${marker.rowLabel ?? ""} ${marker.shopNumber ?? ""}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [markers, searchQuery, level, searchMatchIds]);

  const selectedMarker = markers.find((m) => m.id === selectedShopId) ?? null;
  const defaultFromNodeId =
    fromNodeId ??
    (currentBlock
      ? `entrance-${currentBlock.replace(/-blok/i, "").trim().charAt(0).toUpperCase()}`
      : (levelPlan?.entranceNodeId ?? "entrance-A"));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getIndoorMarketMap(marketSlug);
        cacheIndoorMap(marketSlug, payload);
        if (!cancelled) setPlan(indoorMapResponseToPlan(payload));
      } catch {
        const cached = readCachedIndoorMap(marketSlug);
        if (!cancelled) setPlan(cached ? indoorMapResponseToPlan(cached) : getMarketPlan(marketSlug));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketSlug]);

  const reloadStores = useCallback(async () => {
    setStoresLoading(true);
    setStoresError(null);
    try {
      const res = await getMapStores({ market_slug: marketSlug });
      setMapStores(mergeFeatureCoordinates(res));
    } catch {
      setMapStores([]);
      setStoresError("Do'konlar yuklanmadi. Server yoki internetni tekshiring.");
    } finally {
      setStoresLoading(false);
    }
  }, [marketSlug]);

  useEffect(() => {
    void reloadStores();
  }, [reloadStores, marketSlug]);

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchMatchIds(null);
      return;
    }
    if (!mapStores.length) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchBusy(true);
      try {
        const res = await searchProducts({ q, limit: 40 });
        if (cancelled) return;
        const matchedIds = new Set(
          res.items.map((p) => p.shop?.id).filter((id): id is string => Boolean(id)),
        );
        if (matchedIds.size) {
          setSearchMatchIds(matchedIds);
          setMapStores((prev) => {
            const hits = prev.filter((s) => matchedIds.has(s.id));
            const rest = prev.filter((s) => !matchedIds.has(s.id));
            return [...hits, ...rest];
          });
        } else {
          setSearchMatchIds(null);
        }
      } catch {
        /* keep store list */
      } finally {
        if (!cancelled) setSearchBusy(false);
      }
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchQuery, mapStores.length]);

  const loadShopPopup = useCallback(async (marker: MapShopMarker) => {
    setPopup({
      shop: marker,
      vendorTag: marker.name,
      topProducts: [],
      loading: true,
    });

    if (!marker.slug) {
      setPopup({
        shop: marker,
        vendorTag: "Sotuvchi",
        topProducts: [],
        loading: false,
      });
      return;
    }

    try {
      const res = await getShopProducts(marker.slug);
      const tag = res.shop.is_featured
        ? "⭐ Tanlangan sotuvchi"
        : res.shop.is_verified
          ? "✓ Tasdiqlangan"
          : res.shop.section || "Sotuvchi";
      setPopup({
        shop: { ...marker, rating: res.shop.rating ?? marker.rating },
        vendorTag: tag,
        topProducts: res.items.filter((p) => p.is_available).slice(0, 4),
        loading: false,
      });
    } catch {
      setPopup({
        shop: marker,
        vendorTag: "Sotuvchi",
        topProducts: [],
        loading: false,
      });
    }
  }, []);

  const selectShop = useCallback(
    (marker: MapShopMarker) => {
      setSelectedShopId(marker.id);
      setLevel(marker.pin.floor);
      setCurrentBlock(`${marker.pin.block}-blok`);
      void loadShopPopup(marker);
      triggerHaptic([6, 18, 6]);
    },
    [loadShopPopup, setCurrentBlock],
  );

  const resolveFocusMarker = useCallback((): MapShopMarker | null => {
    if (!focusParams || markers.length === 0) return null;
    return resolveFocusMarkerFromQuery(markers, {
      merchantId: focusParams.merchantId,
      shopSlug: focusParams.shopSlug,
      block: focusParams.block,
      stall: focusParams.stall,
    });
  }, [focusParams, markers]);

  useEffect(() => {
    if (!focusParams?.block) return;
    if (shouldAutoNavigateFromMapSource(focusParams.source)) return;
    const raw = focusParams.block.replace(/-?blok/gi, "").trim();
    const blockLetter = raw.charAt(0).toUpperCase();
    if (!["A", "B", "C", "D"].includes(blockLetter)) return;
    setFromNodeId(`entrance-${blockLetter}`);
    setCurrentBlock(`${blockLetter}-blok`);
    setRouteStartMode("entrance");
  }, [focusParams?.block, focusParams?.source, setCurrentBlock]);

  const initialFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    initialFocusKeyRef.current = null;
  }, [focusParams?.merchantId, focusParams?.shopSlug, focusParams?.focus]);

  /** URL dan bir marta fokus — foydalanuvchi boshqa pin bosganda qayta Anor ga qaytmasin. */
  useEffect(() => {
    if (!focusParams?.focus || storesLoading || !markers.length) return;
    const focusKey = `${focusParams.merchantId ?? ""}:${focusParams.shopSlug ?? ""}`;
    if (initialFocusKeyRef.current === focusKey) return;

    const marker = resolveFocusMarker();
    if (!marker) return;

    initialFocusKeyRef.current = focusKey;
    selectShop(marker);
  }, [
    focusParams?.focus,
    focusParams?.merchantId,
    focusParams?.shopSlug,
    resolveFocusMarker,
    selectShop,
    storesLoading,
    markers.length,
  ]);

  const clearStreetRoute = useCallback(() => {
    streetRouteAbortRef.current?.abort();
    streetRouteAbortRef.current = null;
    setStreetRoutePath(null);
    setStreetRouteDistanceM(null);
    setStreetRouteProvider(null);
    setRoutePathSource(null);
    setStreetRouteLoading(false);
  }, []);

  const fetchStreetRouteForGoal = useCallback(
    async (
      marker: MapShopMarker,
      fromOverride?: GeoLatLng | null,
    ): Promise<{ ok: boolean; distanceM: number | null }> => {
      const osm = fromOverride
        ? {
            from: fromOverride,
            to: stripMapDisplayOffset({ lat: marker.lat, lng: marker.lng }),
          }
        : resolveOsmEndpointsForStreetRoute({
            routeStartMode,
            route,
            selectedMarker: marker,
            anchorMarkers: markers,
            fromNodeId: defaultFromNodeId,
            userLat,
            userLng,
            manualMapStart,
          });

      if (!osm) return { ok: false, distanceM: null };

      setStreetRouteLoading(true);
      streetRouteAbortRef.current?.abort();
      const controller = new AbortController();
      streetRouteAbortRef.current = controller;

      try {
        const res = await fetchWalkingRoutePolyline(osm.from, osm.to, { signal: controller.signal });
        if (controller.signal.aborted) return { ok: false, distanceM: null };

        if (!res?.coordinates?.length || res.coordinates.length < 2) {
          setStreetRoutePath(null);
          setStreetRouteDistanceM(null);
          setStreetRouteProvider(null);
          setRoutePathSource(null);
          return { ok: false, distanceM: null };
        }

        const displayPath = simplifyRoutePath(
          res.coordinates.map((p) => applyMapDisplayOffset(p)),
          800,
        );
        const distanceM =
          res.distanceM ?? (displayPath.length >= 2 ? pathLengthMeters(displayPath) : null);
        setStreetRoutePath(displayPath);
        setStreetRouteDistanceM(distanceM);
        setStreetRouteProvider(res.provider);
        setRoutePathSource("osm");
        return { ok: true, distanceM };
      } catch {
        return { ok: false, distanceM: null };
      } finally {
        setStreetRouteLoading(false);
        streetRouteAbortRef.current = null;
      }
    },
    [
      routeStartMode,
      route,
      markers,
      defaultFromNodeId,
      userLat,
      userLng,
      manualMapStart,
    ],
  );

  const fetchIndoorRouteForGoal = useCallback(
    async (
      goalNodeId: string,
      goalMarker: MapShopMarker,
    ): Promise<{ ok: boolean; distanceM: number | null }> => {
      const safeDistance = (raw: unknown) => {
        const n = typeof raw === "number" ? raw : Number(raw);
        return Number.isFinite(n) ? Math.abs(n) : 0;
      };

      clearStreetRoute();

      const startWgs = resolveIndoorRouteStartWgs84({
        routeStartMode,
        userLat,
        userLng,
        manualMapStart,
      });
      const startInside = startWgs != null && isWgsInsideBazaar(startWgs.lat, startWgs.lng);

      let originGps: GeoLatLng | null = null;
      if ((routeStartMode === "entrance" || routeStartMode === "address") && manualMapStart) {
        originGps = manualMapStart;
      } else if (routeStartMode === "gps" && userLat != null && userLng != null) {
        originGps = applyMapDisplayOffset({ lat: userLat, lng: userLng });
      }

      const anchors = resolveRouteAnchors(markers, goalMarker, defaultFromNodeId);

      try {
        const payload =
          startInside && startWgs
            ? await getIndoorRouteFromCoordinates(marketSlug, level, {
                lat: startWgs.lat,
                lng: startWgs.lng,
                goal_node_id: goalNodeId,
                order_id: focusParams?.orderId ?? undefined,
              })
            : routeStartMode === "stall"
              ? await getIndoorRoute(
                  marketSlug,
                  level,
                  `stall-${manualStallBlock}-${normalizeStallSlot(manualStallInput.trim() || "8", manualStallBlock)}`,
                  goalNodeId,
                )
              : await getIndoorRoute(marketSlug, level, defaultFromNodeId, goalNodeId);

        if (!payload.node_ids?.length || !payload.points?.length) {
          return { ok: false, distanceM: null };
        }

        if (!originGps) {
          originGps = anchors.start;
        }

        const pathStart = startInside ? originGps : anchors.start ?? originGps;
        const anchoredPath = buildAnchoredRoutePath(payload.points, {
          start: pathStart,
          goal: { lat: goalMarker.lat, lng: goalMarker.lng },
        });
        const distanceM =
          anchoredPath.length >= 2 ? pathLengthMeters(anchoredPath) : safeDistance(payload.distance);

        setRoute({
          nodeIds: payload.node_ids,
          points: payload.points,
          distance: safeDistance(payload.distance),
          startNodeId: payload.start_node_id ?? defaultFromNodeId,
          originGps,
        });
        setRoutePathSource("indoor");
        return { ok: true, distanceM };
      } catch {
        return { ok: false, distanceM: null };
      }
    },
    [
      routeStartMode,
      level,
      userLat,
      userLng,
      manualMapStart,
      manualStallBlock,
      manualStallInput,
      defaultFromNodeId,
      markers,
      clearStreetRoute,
    ],
  );

  const requestRoute = useCallback(
    async (goalNodeId: string) => {
      if (isYandexMapsApiEnabled()) return;
      const requestId = ++routeRequestSeqRef.current;
      setRouteLoading(true);
      setRouteError(null);

      const goalMarker = markers.find((m) => stallGraphNodeId(m.pin) === goalNodeId) ?? selectedMarker;
      if (!goalMarker) {
        setRouteLoading(false);
        return;
      }

      const useIndoor =
        !isYandexMapsPreferred() &&
        shouldUseIndoorBazaarRoute({
          routeStartMode,
          goalMarker,
          userLat,
          userLng,
          manualMapStart,
        });

      if (useIndoor) {
        const indoor = await fetchIndoorRouteForGoal(goalNodeId, goalMarker);
        if (requestId !== routeRequestSeqRef.current) return;
        if (indoor.ok) {
          setRouteError(null);
          triggerHaptic([8, 24, 8]);
          setRouteLoading(false);
          return;
        }

        if (routeStartMode === "gps" && userLat != null && userLng != null) {
          const street = await fetchStreetRouteForGoal(goalMarker);
          if (requestId !== routeRequestSeqRef.current) return;
          if (street.ok) {
            setRoute({
              nodeIds: [],
              points: [],
              distance: street.distanceM ?? 0,
              startNodeId: "street",
              originGps: applyMapDisplayOffset({ lat: userLat, lng: userLng }),
            });
            setRouteError(null);
            triggerHaptic([8, 24, 8]);
            setRouteLoading(false);
            return;
          }
        }

        setRoute(null);
        setRouteError(
          "Bozor ichida yo‘l topilmadi. Start nuqtasini rasta yo‘lagiga qo‘ying yoki kirish blokini tanlang.",
        );
        setRouteLoading(false);
        return;
      }

      if (routeStartMode !== "stall") {
        const street = await fetchStreetRouteForGoal(goalMarker);
        if (requestId !== routeRequestSeqRef.current) return;
        if (street.ok) {
          let originGps: GeoLatLng | null = null;
          if (routeStartMode === "gps" && userLat != null && userLng != null) {
            originGps = applyMapDisplayOffset({ lat: userLat, lng: userLng });
          } else if (routeStartMode === "entrance" && manualMapStart) {
            originGps = manualMapStart;
          } else if (routeStartMode === "address" && manualMapStart) {
            originGps = manualMapStart;
          } else {
            const anchors = resolveRouteAnchors(markers, goalMarker, defaultFromNodeId);
            originGps = anchors.start;
          }

          setRoute({
            nodeIds: [],
            points: [],
            distance: street.distanceM ?? 0,
            startNodeId: "street",
            originGps,
          });
          setRouteError(null);
          triggerHaptic([8, 24, 8]);
          setRouteLoading(false);
          return;
        }

        const canIndoorFallback = shouldUseIndoorBazaarRoute({
          routeStartMode,
          goalMarker,
          userLat,
          userLng,
          manualMapStart,
        });

        if (canIndoorFallback) {
          const indoor = await fetchIndoorRouteForGoal(goalNodeId, goalMarker);
          if (requestId !== routeRequestSeqRef.current) return;
          if (indoor.ok) {
            setRouteError(null);
            triggerHaptic([8, 24, 8]);
            setRouteLoading(false);
            return;
          }
        }

        setStreetRoutePath(null);
        setRoute(null);
        setRouteError(
          canIndoorFallback
            ? "Marshrut topilmadi. Startni yo‘lak yoniga bosing yoki GPS ni yangilang."
            : "Ko‘cha yo‘li topilmadi. Startni ko‘cha/trotuar yoniga bosing yoki GPS dan foydalaning.",
        );
        setRouteLoading(false);
        return;
      }

      const indoor = await fetchIndoorRouteForGoal(goalNodeId, goalMarker);
      if (requestId !== routeRequestSeqRef.current) return;
      if (indoor.ok) {
        setRouteError(null);
        triggerHaptic([8, 24, 8]);
      } else {
        setRoute(null);
        setRouteError("Marshrut topilmadi. Kirish nuqtasini yoki GPS ni o'zgartirib qayta urinib ko'ring.");
      }
      setRouteLoading(false);
    },
    [
      routeStartMode,
      defaultFromNodeId,
      level,
      userLat,
      userLng,
      manualStallBlock,
      manualStallInput,
      manualMapStart,
      clearStreetRoute,
      fetchStreetRouteForGoal,
      fetchIndoorRouteForGoal,
      markers,
      selectedMarker,
    ],
  );

  useEffect(() => {
    if (isYandexMapsApiEnabled()) return;
    if (!selectedMarker) {
      setRoute(null);
      clearStreetRoute();
      return;
    }
    const goalNodeId = stallGraphNodeId(selectedMarker.pin);
    const timer = window.setTimeout(() => {
      void requestRoute(goalNodeId);
    }, 280);
    return () => window.clearTimeout(timer);
  }, [selectedMarker?.id, level, routeStartMode, manualMapStart, requestRoute, clearStreetRoute]);

  const routeStartDisplay = useMemo((): GeoLatLng | null => {
    if (streetRoutePath && streetRoutePath.length >= 2) {
      const anchors = resolveRouteAnchors(markers, selectedMarker, defaultFromNodeId);
      const start = route?.originGps ?? manualMapStart ?? anchors.start;
      const goal = anchors.goal;
      const line = finalizeStreetRoutePath(streetRoutePath, start, goal);
      if (line.length >= 2) return line[0]!;
    }
    if (route?.originGps) return route.originGps;
    if (manualMapStart) return manualMapStart;
    if (routeStartMode === "gps" && userLat != null && userLng != null) {
      return applyMapDisplayOffset({ lat: userLat, lng: userLng });
    }
    if (routeStartMode === "address" && manualMapStart) {
      return manualMapStart;
    }
    const anchors = resolveRouteAnchors(markers, selectedMarker, defaultFromNodeId);
    return anchors.start;
  }, [
    streetRoutePath,
    route?.originGps,
    routeStartMode,
    manualMapStart,
    userLat,
    userLng,
    markers,
    selectedMarker,
    defaultFromNodeId,
  ]);

  const routeDistanceLabel = useMemo(() => {
    if (routePathSource === "osm") {
      const meters =
        streetRouteDistanceM ??
        (streetRoutePath && streetRoutePath.length >= 2 ? pathLengthMeters(streetRoutePath) : null);
      return formatRouteDistanceLabel({ source: "osm", metersM: meters });
    }
    if (routePathSource === "indoor" && route?.points?.length) {
      const anchors = resolveRouteAnchors(markers, selectedMarker, defaultFromNodeId);
      const start = route.originGps ?? anchors.start;
      const path = buildAnchoredRoutePath(route.points, {
        start,
        goal: anchors.goal,
      });
      if (path.length >= 2) {
        return formatRouteDistanceLabel({ source: "indoor", metersM: pathLengthMeters(path) });
      }
    }
    if (route?.distance != null) {
      return formatRouteDistanceLabel({ source: "indoor", indoorUnits: route.distance });
    }
    return null;
  }, [
    routePathSource,
    streetRouteDistanceM,
    streetRoutePath,
    route?.distance,
    route?.points,
    route?.originGps,
    markers,
    selectedMarker,
    defaultFromNodeId,
  ]);

  const routeStartHint = useMemo((): string | null => {
    let start: GeoLatLng | null = null;
    if (manualMapStart) {
      start = stripMapDisplayOffset(manualMapStart);
    } else if (
      routeStartMode === "gps" &&
      userLat != null &&
      userLng != null &&
      Number.isFinite(userLat) &&
      Number.isFinite(userLng)
    ) {
      start = { lat: userLat, lng: userLng };
    }
    if (!start || isWgsInsideBazaar(start.lat, start.lng)) return null;

    if (routePathSource === "osm" && streetRoutePath && streetRoutePath.length >= 2) {
      const via =
        streetRouteProvider === "yandex"
          ? "Yandex"
          : streetRouteProvider === "openrouteservice"
            ? "OpenRouteService"
            : "xarita";
      return `Tashqaridan do‘konga — ${via} bo‘yicha haqiqiy ko‘cha yo‘li.`;
    }

    return "Uyingiz yoki avtoto‘xtash joyini xaritada bosing (A nuqta), keyin «Marshrutni boshlash».";
  }, [
    manualMapStart,
    routeStartMode,
    userLat,
    userLng,
    routePathSource,
    streetRoutePath,
    streetRouteProvider,
  ]);

  const hasActiveRoute =
    (streetRoutePath != null && streetRoutePath.length >= 2) ||
    (route?.points != null && route.points.length >= 1);

  const showRouteStartMarker = routeStartDisplay != null && hasActiveRoute;

  const clearManualMapStart = useCallback(() => {
    setManualMapStart(null);
  }, []);

  const locateUser = useCallback((): Promise<{ lat: number; lng: number; accuracyM: number } | null> => {
    setGpsError(null);
    if (!navigator.geolocation) {
      setGpsError("Brauzer GPS ni qo‘llab-quvvatlamaydi.");
      triggerHaptic([20, 40]);
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const acceptFix = (lat: number, lng: number, accuracyM: number) => {
        setManualMapStart(null);
        setAddressLabel(null);
        setAddressQuery("");
        setRouteStartMode("gps");
        setUserGps(lat, lng, accuracyM);
        setUseGpsForRoute(true);
        if (!sanitizeUserGps(lat, lng)) {
          setGpsError(
            "GPS bozor hududidan tashqarida — marshrut do‘kon blok kirishidan boshlanadi yoki manzil tanlang.",
          );
        } else {
          setGpsError(null);
        }
        triggerHaptic([10, 20, 10]);
        resolve({ lat, lng, accuracyM });
      };

      const onFail = (err?: GeolocationPositionError) => {
        const code = err?.code;
        const hint =
          code === 1
            ? "Joylashuv rad etildi — brauzer sozlamalarida «Ruxsat berish» ni tanlang."
            : code === 2
              ? "Signal topilmadi. Tashqariga chiqing yoki Wi‑Fi/GPS yoqing."
              : code === 3
                ? "Vaqt tugadi. Qayta «Joylashuvni olish» bosing."
                : "Joylashuv olinmadi. HTTPS yoki localhost kerak.";
        setGpsError(hint);
        triggerHaptic([20, 40]);
        resolve(null);
      };

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude: lat, longitude: lng, accuracy } = pos.coords;
          acceptFix(lat, lng, accuracy);
        },
        (err) => {
          navigator.geolocation.getCurrentPosition(
            (fallback) => {
              const { latitude: lat, longitude: lng, accuracy } = fallback.coords;
              acceptFix(lat, lng, accuracy);
            },
            () => onFail(err),
            { enableHighAccuracy: false, maximumAge: 15000, timeout: 25000 },
          );
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
      );
    });
  }, [setUserGps, setUseGpsForRoute, setRouteStartMode, setAddressLabel, setAddressQuery]);

  const handleFromNodeChange = useCallback(
    (nodeId: string) => {
      setRouteStartMode("entrance");
      setUseGpsForRoute(false);
      setFromNodeId(nodeId);
      if (selectedMarker) {
        void requestRoute(stallGraphNodeId(selectedMarker.pin));
      }
    },
    [setUseGpsForRoute, selectedMarker, requestRoute],
  );

  const setStartFromMapPoint = useCallback((lat: number, lng: number) => {
    setUseGpsForRoute(false);
    setGpsError(null);
    setAddressLabel(null);
    setManualMapStart({ lat, lng });
  }, [setUseGpsForRoute]);

  const setStartFromAddress = useCallback(
    (hit: { lat: number; lng: number; label: string }) => {
      setUseGpsForRoute(false);
      setGpsError(null);
      setRouteStartMode("address");
      setAddressLabel(hit.label);
      setAddressQuery(hit.label);
      setManualMapStart(applyMapDisplayOffset({ lat: hit.lat, lng: hit.lng }));
    },
    [setUseGpsForRoute],
  );

  const clearAddressStart = useCallback(() => {
    setAddressLabel(null);
    setAddressQuery("");
    if (routeStartMode === "address") {
      setManualMapStart(null);
    }
  }, [routeStartMode]);

  const buildRouteFromPanel = useCallback(() => {
    if (!selectedMarker) return;
    void requestRoute(stallGraphNodeId(selectedMarker.pin));
  }, [requestRoute, selectedMarker]);

  return {
    plan,
    level,
    setLevel,
    levelPlan,
    markers: filteredMarkers,
    allMarkers: markers,
    storesLoading,
    storesError,
    routeError,
    routeStartHint,
    reloadStores,
    searchQuery,
    setSearchQuery,
    searchBusy,
    selectedMarker,
    selectShop,
    popup,
    setPopup,
    route,
    streetRoutePath,
    routePathSource,
    streetRouteProvider,
    routeDistanceLabel,
    routeStartDisplay,
    showRouteStartMarker,
    streetRouteLoading,
    routeLoading,
    defaultFromNodeId,
    setFromNodeId: handleFromNodeChange,
    buildRouteFromPanel,
    locateUser,
    patchUserGps,
    userLat,
    userLng,
    userAccuracyM,
    routeStartMode,
    setRouteStartMode,
    manualStallBlock,
    setManualStallBlock,
    manualStallInput,
    setManualStallInput,
    addressQuery,
    setAddressQuery,
    addressLabel,
    setStartFromAddress,
    clearAddressStart,
    gpsError,
    manualMapStart,
    setStartFromMapPoint,
    clearManualMapStart,
    entrancePoint: entranceMapPoint(currentBlock),
    requestRoute,
    fetchStreetRouteForGoal,
    focusMarker: resolveFocusMarker(),
  };
}
