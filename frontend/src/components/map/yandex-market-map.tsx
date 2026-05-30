"use client";

import { useEffect, useRef, useState } from "react";

import {
  applyMapDisplayOffset,
  haversineMeters,
  IPPODROM_CENTER,
  isInsideIppodromGpsAcceptZone,
  stripMapDisplayOffset,
  type GeoLatLng,
} from "@/lib/geo/market-geo";
import {
  clampMarketRouteStart,
  isLocalMarketRoute,
  MAX_BOZOR_ROUTE_METERS,
  shouldPreferOsmWalkingRoute,
  wgs84ToYandexPoint,
} from "@/lib/map/yandex-coords";
import { fetchWalkingRoutePolyline } from "@/lib/map/fetch-walking-route";
import {
  createYandexMapHandle,
  type BuildRouteToShopOptions,
  type BuildRouteToShopResult,
  type YandexMapHandle,
} from "@/lib/map/yandex-map-handle";
import {
  loadYandexMaps,
  resetYandexMapsLoader,
  yandexMapsReferrerPatterns,
} from "@/lib/map/yandex-maps-loader";
import {
  DEFAULT_YANDEX_MAP_LAYER,
  type YandexMapLayerId,
} from "@/lib/map/yandex-map-types";
import { finalizeStreetRoutePath } from "@/lib/map/route-geometry";
import { resolveRouteStartWgs84 } from "@/lib/map/resolve-route-start";
import { locationDetailsFromMarker } from "@/lib/map/shop-location-display";
import { spreadMarkerDisplayCoords } from "@/lib/map/spread-marker-coords";
import type { MapShopMarker } from "@/lib/shop-location";
import type { RouteStartMode } from "@/hooks/useIppodromMapPage";
import type { YandexTransportMode } from "@/lib/map/yandex-transport-modes";
import { cn } from "@/lib/utils";

export type YandexMarketMapProps = {
  apiKey: string;
  markers: MapShopMarker[];
  selectedShopId: string | null;
  fromNodeId: string;
  routeStartMode: RouteStartMode;
  manualMapStart: { lat: number; lng: number } | null;
  userLat?: number | null;
  userLng?: number | null;
  focusTarget?: GeoLatLng | null;
  focusToken?: string;
  pickStartOnMap?: boolean;
  onSelectShop: (marker: MapShopMarker) => void;
  onPickStartPoint?: (lat: number, lng: number) => void;
  onRouteCalculated?: (info: { distanceM: number | null; error: string | null }) => void;
  onMapReady?: (handle: YandexMapHandle | null) => void;
  routeRefreshKey?: number;
  /** false = faqat do‘kon ko‘rsatiladi (buyurtma/mahsulot linki), marshrut «Marshrutni boshlash» dan keyin */
  autoBuildRoute?: boolean;
  /** GPS aniq kelganda — React props kechikmasligi uchun to‘g‘ridan-to‘g‘ri start. */
  routeGpsAnchor?: GeoLatLng | null;
  /** Yandex MultiRoute (avto / piyoda / jamoat) — «Navigatsiyani boshlash». */
  navigationKey?: number;
  navigationMode?: YandexTransportMode;
  mapLayer?: YandexMapLayerId;
  fitRouteOnBuild?: boolean;
  onLoadFailed?: (message: string) => void;
  /** Foydalanuvchi xaritani qo‘lda siljitganda (kuzatishni o‘chirish). */
  onMapUserInteract?: () => void;
  /** true = faqat do‘kon pinlari; marshrut Yandex ilovasida ochiladi. */
  shopsOnly?: boolean;
  className?: string;
};

const LINE_STYLE = {
  strokeColor: "#1E98FF",
  strokeWidth: 6,
  strokeOpacity: 0.92,
  lineJoin: "round",
  lineCap: "round",
} as const;

function shopWgs84(m: MapShopMarker): GeoLatLng {
  return stripMapDisplayOffset({ lat: m.lat, lng: m.lng });
}

function fitLocalRouteBounds(map: ymaps.Map, startPt: [number, number], goalPt: [number, number]) {
  try {
    const bounds = ymaps.util.bounds.fromPoints([startPt, goalPt]);
    map.setBounds(bounds, {
      checkZoomRange: true,
      zoomMargin: 80,
      duration: 450,
      flying: true,
    });
    const zoom = map.getZoom();
    if (zoom < 16) {
      map.setZoom(16, { duration: 300, checkZoomRange: true });
    } else if (zoom > 18) {
      map.setZoom(18, { duration: 300, checkZoomRange: true });
    }
  } catch {
    /* ignore */
  }
}

type YandexRouteProps = { get: (name: string) => { value?: number } | null };
type YandexMrLike = {
  getActiveRoute?: () => { properties: YandexRouteProps };
  model?: {
    getActiveRoute?: () => { properties: YandexRouteProps };
    getRoutes?: () => { get?: (i: number) => { properties: YandexRouteProps } };
    getHumanLength?: () => string;
  };
};

function readMultiRouteDistanceM(mr: ymaps.multiRouter.MultiRoute): number | null {
  try {
    const mrAny = mr as unknown as YandexMrLike;
    const active = mrAny.getActiveRoute?.() ?? mrAny.model?.getActiveRoute?.();
    const dist = active?.properties?.get?.("distance")?.value;
    if (typeof dist === "number" && Number.isFinite(dist) && dist > 0) return dist;

    const route0 = mrAny.model?.getRoutes?.()?.get?.(0);
    const d0 = route0?.properties?.get?.("distance")?.value;
    if (typeof d0 === "number" && Number.isFinite(d0) && d0 > 0) return d0;

    const human = mrAny.model?.getHumanLength?.();
    if (typeof human === "string" && human.trim()) {
      const km = human.match(/([\d,.]+)\s*km/i);
      const meters = human.match(/([\d,.]+)\s*m(?!i)/i);
      if (km) return Number.parseFloat(km[1]!.replace(",", ".")) * 1000;
      if (meters) return Number.parseFloat(meters[1]!.replace(",", "."));
    }
  } catch {
    /* ignore */
  }
  return null;
}

function resolveStart(
  markers: MapShopMarker[],
  fromNodeId: string,
  routeStartMode: RouteStartMode,
  manualMapStart: { lat: number; lng: number } | null,
  userLat: number | null,
  userLng: number | null,
  routeGpsAnchor: GeoLatLng | null,
): GeoLatLng | null {
  if (
    routeGpsAnchor &&
    Number.isFinite(routeGpsAnchor.lat) &&
    Number.isFinite(routeGpsAnchor.lng)
  ) {
    return routeGpsAnchor;
  }

  const fromMode = resolveRouteStartWgs84({
    routeStartMode,
    userLat,
    userLng,
    manualMapStart,
  });
  if (fromMode) return fromMode;

  const blockMatch = fromNodeId.match(/entrance-([A-D])/i);
  if (blockMatch) {
    const block = blockMatch[1].toUpperCase();
    const entrance =
      markers.find((m) => m.pin.block.toUpperCase() === block && m.pin.stall === "08") ??
      markers.find((m) => m.pin.block.toUpperCase() === block);
    if (entrance) return shopWgs84(entrance);
  }
  return null;
}

export function YandexMarketMap({
  apiKey,
  markers,
  selectedShopId,
  fromNodeId,
  routeStartMode,
  manualMapStart,
  userLat = null,
  userLng = null,
  focusTarget = null,
  focusToken = "",
  pickStartOnMap = false,
  onSelectShop,
  onPickStartPoint,
  onRouteCalculated,
  onMapReady,
  routeRefreshKey = 0,
  autoBuildRoute = true,
  routeGpsAnchor = null,
  navigationKey = 0,
  navigationMode = "pedestrian",
  mapLayer = DEFAULT_YANDEX_MAP_LAYER,
  fitRouteOnBuild = true,
  onLoadFailed,
  onMapUserInteract,
  shopsOnly = true,
  className,
}: YandexMarketMapProps) {
  const onMapUserInteractRef = useRef(onMapUserInteract);
  onMapUserInteractRef.current = onMapUserInteract;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ymaps.Map | null>(null);
  const clustererRef = useRef<ymaps.Clusterer | null>(null);
  const trafficControlRef = useRef<InstanceType<typeof ymaps.control.TrafficControl> | null>(null);
  const routeLineRef = useRef<ymaps.Polyline | null>(null);
  const multiRouteRef = useRef<ymaps.multiRouter.MultiRoute | null>(null);
  const userPmRef = useRef<ymaps.Placemark | null>(null);
  const startPmRef = useRef<ymaps.Placemark | null>(null);
  const routeAbortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);
  const routeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const routeBuildGenRef = useRef(0);
  const navigationModeRef = useRef(navigationMode);
  const routeRefreshKeyRef = useRef(routeRefreshKey);
  const lastCenterShopRef = useRef<string | null>(null);
  const placemarkByShopIdRef = useRef<Map<string, ymaps.Placemark>>(new Map());
  const ignoreNextMapClickRef = useRef(false);
  const geoClickBoundRef = useRef(false);
  const markersSigRef = useRef("");
  const displayCoordsRef = useRef<Map<string, GeoLatLng>>(new Map());
  const shopsOnlyRef = useRef(shopsOnly);
  shopsOnlyRef.current = shopsOnly;
  navigationModeRef.current = navigationMode;
  routeRefreshKeyRef.current = routeRefreshKey;

  const propsRef = useRef({
    markers,
    selectedShopId,
    fromNodeId,
    routeStartMode,
    manualMapStart,
    userLat,
    userLng,
    onSelectShop,
    onPickStartPoint,
    onRouteCalculated,
    pickStartOnMap,
    routeGpsAnchor,
  });
  propsRef.current = {
    markers,
    selectedShopId,
    fromNodeId,
    routeStartMode,
    manualMapStart,
    userLat,
    userLng,
    routeGpsAnchor,
    onSelectShop,
    onPickStartPoint,
    onRouteCalculated,
    pickStartOnMap,
  };

  const [loadError, setLoadError] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const mapReadyRef = useRef(false);
  const routeBuildOverrideRef = useRef<{ start: GeoLatLng; shopId: string } | null>(null);
  const pendingRouteBuildRef = useRef<{
    resolve: (result: BuildRouteToShopResult) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  } | null>(null);
  const buildRouteToShopRef = useRef<(opts: BuildRouteToShopOptions) => Promise<BuildRouteToShopResult>>(
    async () => ({ ok: false, distanceM: null, error: "Xarita tayyor emas" }),
  );

  useEffect(() => {
    mapReadyRef.current = mapReady;
  }, [mapReady]);

  function emitRouteResult(info: { distanceM: number | null; error: string | null }) {
    propsRef.current.onRouteCalculated?.(info);
    const pending = pendingRouteBuildRef.current;
    if (!pending) return;
    clearTimeout(pending.timeoutId);
    pendingRouteBuildRef.current = null;
    routeBuildOverrideRef.current = null;
    pending.resolve({
      ok: !info.error && info.distanceM != null,
      distanceM: info.distanceM,
      error: info.error,
    });
  }

  function resolveRouteGoal(
    p: typeof propsRef.current,
  ): MapShopMarker | null {
    const overrideShopId = routeBuildOverrideRef.current?.shopId;
    const shopId = overrideShopId ?? p.selectedShopId;
    if (!shopId) return null;
    return p.markers.find((m) => m.id === shopId) ?? null;
  }

  function resolveRouteStartPoint(
    p: typeof propsRef.current,
  ): GeoLatLng | null {
    const overrideStart = routeBuildOverrideRef.current?.start;
    if (overrideStart) return overrideStart;
    return resolveStart(
      p.markers,
      p.fromNodeId,
      p.routeStartMode,
      p.manualMapStart,
      p.userLat,
      p.userLng,
      p.routeGpsAnchor,
    );
  }

  function clearAllRoutes(map: ymaps.Map) {
    if (routeLineRef.current) {
      map.geoObjects.remove(routeLineRef.current);
      routeLineRef.current = null;
    }
    if (multiRouteRef.current) {
      try {
        map.geoObjects.remove(multiRouteRef.current);
      } catch {
        /* ignore */
      }
      multiRouteRef.current = null;
    }
  }

  function clearShopLayer(map: ymaps.Map) {
    if (clustererRef.current) {
      try {
        map.geoObjects.remove(clustererRef.current);
      } catch {
        /* ignore */
      }
      clustererRef.current = null;
    }
    for (const pm of placemarkByShopIdRef.current.values()) {
      try {
        map.geoObjects.remove(pm);
      } catch {
        /* ignore */
      }
    }
    placemarkByShopIdRef.current.clear();
  }

  function findNearestShopAt(lat: number, lng: number, maxMeters = 200): MapShopMarker | null {
    const p = propsRef.current;
    let best: MapShopMarker | null = null;
    let bestD = maxMeters;
    for (const m of p.markers) {
      const pos = displayCoordsRef.current.get(m.id) ?? { lat: m.lat, lng: m.lng };
      const d = haversineMeters({ lat, lng }, pos);
      if (d < bestD) {
        bestD = d;
        best = m;
      }
    }
    return best;
  }

  function selectShopFromPlacemark(marker: MapShopMarker) {
    ignoreNextMapClickRef.current = true;
    window.setTimeout(() => {
      ignoreNextMapClickRef.current = false;
    }, 120);
    propsRef.current.onSelectShop(marker);
  }

  function resolveMarkerFromGeoTarget(target: unknown): MapShopMarker | null {
    if (!target || typeof target !== "object") return null;
    const props = (target as { properties?: { get?: (key: string) => unknown } }).properties;
    if (!props?.get) return null;
    const shopId = props.get("shopId") as string | undefined;
    if (!shopId) return null;
    return propsRef.current.markers.find((m) => m.id === shopId) ?? null;
  }

  function bindShopPlacemarkEvents(pm: ymaps.Placemark, marker: MapShopMarker) {
    const onPick = () => selectShopFromPlacemark(marker);
    const events = (pm as { events?: { add: (name: string, fn: () => void) => void } }).events;
    events?.add("click", onPick);
    events?.add("tap", onPick);
    events?.add("mouseup", onPick);
  }

  function bindGeoObjectClicks(map: ymaps.Map) {
    if (geoClickBoundRef.current) return;
    geoClickBoundRef.current = true;
    const geoEvents = (map.geoObjects as { events?: { add: (name: string, fn: (e: { get: (k: string) => unknown }) => void) => void } }).events;
    geoEvents?.add("click", (e) => {
      const marker = resolveMarkerFromGeoTarget(e.get("target"));
      if (marker) selectShopFromPlacemark(marker);
    });
  }

  function shopPlacemarkPreset(focused: boolean) {
    return focused ? "islands#redShoppingIcon" : "islands#blueShoppingIcon";
  }

  function updateShopPlacemarkFocus() {
    const p = propsRef.current;

    for (const marker of p.markers) {
      const pm = placemarkByShopIdRef.current.get(marker.id);
      if (!pm) continue;
      const focused = marker.id === p.selectedShopId;
      const placemark = pm as unknown as {
        options: { set: (data: Record<string, unknown>) => void };
      };
      placemark.options.set({
        preset: shopPlacemarkPreset(focused),
        zIndex: focused ? 3000 : 1100,
        zIndexHover: focused ? 3100 : 1200,
      });
    }
  }

  function syncShops(map: ymaps.Map) {
    const p = propsRef.current;
    clearShopLayer(map);
    try {
      (map as ymaps.Map & { balloon?: { close: () => void } }).balloon?.close();
    } catch {
      /* ignore */
    }
    if (!p.markers.length) return;

    bindGeoObjectClicks(map);

    const displayCoords = spreadMarkerDisplayCoords(p.markers);
    displayCoordsRef.current = displayCoords;

    const placemarks = p.markers.map((marker) => {
      const focused = marker.id === p.selectedShopId;
      const pos = displayCoords.get(marker.id) ?? { lat: marker.lat, lng: marker.lng };
      const stall = marker.shopNumber?.match(/\d{1,4}/)?.[0] ?? marker.pin.stall;
      const loc = locationDetailsFromMarker(marker);
      const pm = new ymaps.Placemark(
        [pos.lat, pos.lng],
        {
          shopId: marker.id,
          iconContent: stall,
          hintContent: `${marker.name}\n${loc.summary}`,
        },
        {
          preset: shopPlacemarkPreset(focused),
          cursor: "pointer",
          hasBalloon: false,
          hasHint: true,
          openHintOnHover: true,
          openBalloonOnClick: false,
          interactivityModel: "default#opaque",
          zIndex: focused ? 3000 : 1100,
          zIndexHover: focused ? 3100 : 1200,
        },
      );
      bindShopPlacemarkEvents(pm, marker);
      placemarkByShopIdRef.current.set(marker.id, pm);
      return pm;
    });

    const useCluster = !shopsOnlyRef.current && placemarks.length > 24;
    if (useCluster) {
      const clusterer = new ymaps.Clusterer({
        preset: "islands#invertedBlueClusterIcons",
        groupByCoordinates: false,
        clusterDisableClickZoom: true,
        gridSize: 72,
        minClusterSize: 4,
        maxZoom: 16,
      });
      clusterer.add(placemarks);
      map.geoObjects.add(clusterer);
      clustererRef.current = clusterer;
    } else {
      for (const pm of placemarks) {
        map.geoObjects.add(pm);
      }
      clustererRef.current = null;
    }
  }

  function syncStartPm(map: ymaps.Map) {
    if (startPmRef.current) {
      map.geoObjects.remove(startPmRef.current);
      startPmRef.current = null;
    }
    if (shopsOnlyRef.current) return;
    const p = propsRef.current;
    let start = p.manualMapStart;
    if (
      !start &&
      p.routeStartMode === "gps" &&
      p.userLat != null &&
      p.userLng != null &&
      Number.isFinite(p.userLat) &&
      Number.isFinite(p.userLng)
    ) {
      start = applyMapDisplayOffset({ lat: p.userLat, lng: p.userLng });
    }
    if (!start) return;
    const pm = new ymaps.Placemark(
      wgs84ToYandexPoint(stripMapDisplayOffset(start)),
      { hintContent: "Start (A)" },
      { preset: "islands#greenCircleDotIcon" },
    );
    map.geoObjects.add(pm);
    startPmRef.current = pm;
  }

  function syncUserPm(map: ymaps.Map) {
    if (userPmRef.current) {
      map.geoObjects.remove(userPmRef.current);
      userPmRef.current = null;
    }
    const { userLat: lat, userLng: lng, routeStartMode: mode } = propsRef.current;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    const d = applyMapDisplayOffset({ lat, lng });
    const pm = new ymaps.Placemark(
      [d.lat, d.lng],
      { hintContent: mode === "gps" ? "Siz (GPS)" : "Siz" },
      { preset: "islands#blueCircleDotIconWithCaption" },
    );
    map.geoObjects.add(pm);
    userPmRef.current = pm;
  }

  function resolveRouteEndpoints(p: typeof propsRef.current): {
    selected: MapShopMarker;
    startWgs: GeoLatLng;
    goalWgs: GeoLatLng;
    startPt: [number, number];
    goalPt: [number, number];
    gpsClamped: boolean;
  } | null {
    const selected = resolveRouteGoal(p);
    if (!selected) return null;

    const rawStart = resolveRouteStartPoint(p);
    if (!rawStart) return null;

    const goalWgs = shopWgs84(selected);
    const startWgs = clampMarketRouteStart(rawStart, goalWgs, p.markers, selected);
    const gpsClamped =
      p.routeStartMode === "gps" &&
      rawStart != null &&
      !isInsideIppodromGpsAcceptZone(rawStart.lat, rawStart.lng) &&
      (rawStart.lat !== startWgs.lat || rawStart.lng !== startWgs.lng);

    return {
      selected,
      startWgs,
      goalWgs,
      startPt: wgs84ToYandexPoint(startWgs),
      goalPt: wgs84ToYandexPoint(goalWgs),
      gpsClamped,
    };
  }

  async function buildRouteNow(
    map: ymaps.Map,
    mode: YandexTransportMode,
    endpoints?: NonNullable<ReturnType<typeof resolveRouteEndpoints>>,
  ) {
    const p = propsRef.current;
    clearAllRoutes(map);
    routeAbortRef.current?.abort();
    routeAbortRef.current = new AbortController();

    const ep = endpoints ?? resolveRouteEndpoints(p);
    if (!ep) {
      emitRouteResult({
        distanceM: null,
        error: "Do‘kon yoki start nuqtasi tanlanmagan.",
      });
      return;
    }

    const { selected, startWgs, goalWgs, startPt, goalPt, gpsClamped } = ep;

    const res = await fetchWalkingRoutePolyline(startWgs, goalWgs, {
      signal: routeAbortRef.current.signal,
    });

    if (routeAbortRef.current.signal.aborted) return;
    if (mode !== navigationModeRef.current) return;

    if (!res?.coordinates?.length || res.coordinates.length < 2) {
      emitRouteResult({
        distanceM: null,
        error:
          mode === "pedestrian"
            ? "Marshrut topilmadi. Boshqa joy tanlang (masalan: Metro Chilonzor) yoki GPS dan foydalaning."
            : "Bu transport rejimi uchun Yandex marshruti kerak — qayta urinib ko‘ring.",
      });
      return;
    }

    const startDisplay = wgs84ToYandexPoint(startWgs);
    const goalDisplay = wgs84ToYandexPoint(goalWgs);
    const path = finalizeStreetRoutePath(
      res.coordinates.map((c) => applyMapDisplayOffset(c)),
      { lat: startDisplay[0], lng: startDisplay[1] },
      { lat: goalDisplay[0], lng: goalDisplay[1] },
    );

    const line = new ymaps.Polyline(
      path.map((c) => [c.lat, c.lng]),
      {},
      LINE_STYLE,
    );
    map.geoObjects.add(line);
    routeLineRef.current = line;

    if (fitRouteOnBuild) {
      fitLocalRouteBounds(map, startPt, goalPt);
    }

    const distanceM =
      res.distanceM ?? (path.length >= 2 ? haversineMeters(startWgs, goalWgs) : null);

    emitRouteResult({
      distanceM,
      error: gpsClamped
        ? "GPS bozor tashqarisida — marshrut do‘kon blok kirishidan boshlanadi."
        : null,
    });
  }

  async function buildRouteForMode(map: ymaps.Map, mode: YandexTransportMode) {
    const buildGen = ++routeBuildGenRef.current;
    const p = propsRef.current;
    clearAllRoutes(map);
    routeAbortRef.current?.abort();

    const ep = resolveRouteEndpoints(p);
    if (!ep) {
      emitRouteResult({
        distanceM: null,
        error:
          p.routeStartMode === "gps"
            ? "Avval «Joylashuvni olish» tugmasini bosing."
            : p.routeStartMode === "address"
              ? "Joy nomini qidiring va ro‘yxatdan tanlang."
              : "Start: xaritada bosing, joy qidiring yoki A/B/C/D blok tanlang.",
      });
      return;
    }

    const { selected, startWgs, goalWgs, startPt, goalPt } = ep;

    if (shouldPreferOsmWalkingRoute(startWgs, goalWgs, mode)) {
      await buildRouteNow(map, mode, ep);
      return;
    }

    if (!isLocalMarketRoute(startWgs, goalWgs)) {
      await buildRouteNow(map, mode, ep);
      return;
    }

    const ymapsApi = window.ymaps;

    if (!ymapsApi?.multiRouter?.MultiRoute) {
      if (mode === "pedestrian") {
        await buildRouteNow(map, mode, ep);
      } else {
        emitRouteResult({
          distanceM: null,
          error: "Avto va jamoat transport uchun Yandex Maps API (package.full) kerak.",
        });
      }
      return;
    }

    const rejectAbsurdMultiRoute = () => {
      if (multiRouteRef.current) {
        try {
          map.geoObjects.remove(multiRouteRef.current);
        } catch {
          /* ignore */
        }
        multiRouteRef.current = null;
      }
      void buildRouteNow(map, mode, ep);
    };

    try {
      const mr = new ymapsApi.multiRouter.MultiRoute(
        {
          referencePoints: [startPt, goalPt],
          params: { routingMode: mode },
        },
        {
          boundsAutoApply: false,
          wayPointVisible: true,
          pinVisible: true,
          routeActiveStrokeWidth: 7,
          routeActiveStrokeColor: mode === "auto" ? "#22c55e" : mode === "masstransit" ? "#a855f7" : "#1E98FF",
        },
      );

      map.geoObjects.add(mr);
      multiRouteRef.current = mr;

      const finishOk = () => {
        if (buildGen !== routeBuildGenRef.current || mode !== navigationModeRef.current) return;
        let distanceM = readMultiRouteDistanceM(mr);
        if (distanceM == null) {
          distanceM = haversineMeters(startWgs, goalWgs);
        }
        if (distanceM > MAX_BOZOR_ROUTE_METERS) {
          rejectAbsurdMultiRoute();
          return;
        }
        if (fitRouteOnBuild) {
          fitLocalRouteBounds(map, startPt, goalPt);
        }
        emitRouteResult({
          distanceM,
          error: ep.gpsClamped
            ? "GPS bozor tashqarisida — marshrut do‘kon blok kirishidan boshlanadi."
            : null,
        });
      };

      const finishFail = () => {
        if (buildGen !== routeBuildGenRef.current || mode !== navigationModeRef.current) return;
        rejectAbsurdMultiRoute();
      };

      mr.model.events.add("requestsuccess", finishOk);
      mr.model.events.add("requestfail", finishFail);
    } catch {
      if (buildGen !== routeBuildGenRef.current || mode !== navigationModeRef.current) return;
      if (mode === "pedestrian") {
        await buildRouteNow(map, mode, ep);
      } else {
        emitRouteResult({
          distanceM: null,
          error:
            mode === "auto"
              ? "Avtomobil marshruti topilmadi. Boshqa start nuqtasini sinab ko‘ring."
              : "Jamoat transport marshruti topilmadi. Piyoda yoki avto rejimini tanlang.",
        });
      }
    }
  }

  async function buildRouteToShopImperative(
    opts: BuildRouteToShopOptions,
  ): Promise<BuildRouteToShopResult> {
    if (shopsOnlyRef.current) {
      return { ok: false, distanceM: null, error: "Marshrut Yandex Navigator orqali ochiladi." };
    }
    const map = mapRef.current;
    if (!map || !mapReadyRef.current) {
      return { ok: false, distanceM: null, error: "Xarita tayyor emas" };
    }

    const shop = propsRef.current.markers.find((m) => m.id === opts.shopId);
    if (!shop) {
      return { ok: false, distanceM: null, error: "Do‘kon topilmadi" };
    }

    if (pendingRouteBuildRef.current) {
      clearTimeout(pendingRouteBuildRef.current.timeoutId);
      pendingRouteBuildRef.current.resolve({
        ok: false,
        distanceM: null,
        error: null,
      });
    }

    routeBuildOverrideRef.current = { start: opts.from, shopId: opts.shopId };
    propsRef.current.routeGpsAnchor = opts.from;

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        if (!pendingRouteBuildRef.current) return;
        pendingRouteBuildRef.current = null;
        routeBuildOverrideRef.current = null;
        resolve({ ok: false, distanceM: null, error: "Marshrut vaqti tugadi — qayta urinib ko‘ring." });
      }, 28000);

      pendingRouteBuildRef.current = { resolve, timeoutId };
      void buildRouteForMode(map, opts.mode ?? navigationModeRef.current);
    });
  }

  buildRouteToShopRef.current = buildRouteToShopImperative;

  const autoBuildRef = useRef(autoBuildRoute);
  autoBuildRef.current = autoBuildRoute;

  function scheduleRouteBuild(map: ymaps.Map) {
    if (shopsOnlyRef.current) return;
    const p = propsRef.current;
    if (!autoBuildRef.current && routeRefreshKeyRef.current < 1 && !p.routeGpsAnchor) return;
    if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
    routeTimerRef.current = setTimeout(() => {
      void buildRouteForMode(map, navigationModeRef.current);
    }, 280);
  }

  useEffect(() => {
    if (mountedRef.current) return;
    let cancelled = false;

    void loadYandexMaps(apiKey).then((ymapsApi) => {
      if (cancelled || !containerRef.current) return;
      mountedRef.current = true;

      const displayCenter = applyMapDisplayOffset(IPPODROM_CENTER);
      const map = new ymapsApi.Map(
        containerRef.current,
        {
          center: [displayCenter.lat, displayCenter.lng],
          zoom: 17,
          type: mapLayer,
          controls: ["zoomControl", "geolocationControl", "fullscreenControl"],
        },
        {
          suppressMapOpenBlock: true,
          autoFitToViewport: "always",
          yandexMapDisablePoiInteractivity: false,
          suppressObsoleteBrowserNotifier: true,
        },
      );

      map.controls.get("zoomControl")?.options.set("position", { right: 10, top: 108 });
      map.controls.get("geolocationControl")?.options.set("position", { right: 10, top: 48 });
      map.controls.get("fullscreenControl")?.options.set("position", { right: 10, bottom: 24 });

      try {
        const traffic = new ymapsApi.control.TrafficControl({
          state: { trafficVisible: false, providerKey: "traffic#actual" },
        });
        map.controls.add(traffic, { float: "none", position: { right: 10, top: 168 } });
        trafficControlRef.current = traffic;
      } catch {
        trafficControlRef.current = null;
      }

      map.behaviors.enable(["scrollZoom", "dblClickZoom", "multiTouch", "drag"]);

      map.events.add("click", (e) => {
        if (ignoreNextMapClickRef.current) return;
        const coords = e.get("coords") as number[] | undefined;
        if (!coords || coords.length < 2) return;
        const [lat, lng] = coords;

        if (shopsOnlyRef.current) {
          const hit = findNearestShopAt(lat, lng, 320);
          if (hit) selectShopFromPlacemark(hit);
          return;
        }

        const pr = propsRef.current;
        if (!pr.pickStartOnMap || !pr.onPickStartPoint) return;
        pr.onPickStartPoint(lat, lng);
      });

      map.events.add("mousemove", (e) => {
        if (!containerRef.current) return;
        const coords = e.get("coords") as number[] | undefined;
        if (!coords || coords.length < 2) {
          containerRef.current.style.cursor = "";
          return;
        }
        const hoverRadius = shopsOnlyRef.current ? 220 : 120;
        const near = findNearestShopAt(coords[0], coords[1], hoverRadius);
        containerRef.current.style.cursor = near ? "pointer" : "";
      });

      map.events.add("actionend", (e) => {
        const action = e.get("action") as string | undefined;
        if (action === "drag" || action === "multiTouch") {
          onMapUserInteractRef.current?.();
        }
      });

      mapRef.current = map;
      bindGeoObjectClicks(map);
      syncShops(map);
      syncStartPm(map);
      syncUserPm(map);
      if (!shopsOnlyRef.current && (autoBuildRef.current || routeRefreshKey > 0)) {
        scheduleRouteBuild(map);
      }
      setMapReady(true);
      onMapReady?.(
        createYandexMapHandle(map, trafficControlRef, {
          isMapReady: () => mapReadyRef.current && mapRef.current != null,
          buildRouteToShop: (opts) => buildRouteToShopRef.current(opts),
        }),
      );
    }).catch((err) => {
      if (!cancelled) {
        const msg = err instanceof Error ? err.message : "Yandex xato";
        setLoadError(msg);
        onMapReady?.(null);
        onLoadFailed?.(msg);
      }
    });

    return () => {
      cancelled = true;
      routeAbortRef.current?.abort();
      if (routeTimerRef.current) clearTimeout(routeTimerRef.current);
      mapRef.current?.destroy();
      mapRef.current = null;
      mountedRef.current = false;
      setMapReady(false);
      onMapReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const sig = markers.map((m) => `${m.id}:${m.lat}:${m.lng}`).join("|");
    if (sig === markersSigRef.current && placemarkByShopIdRef.current.size > 0) {
      updateShopPlacemarkFocus();
      return;
    }
    markersSigRef.current = sig;
    syncShops(map);
  }, [mapReady, markers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    if (placemarkByShopIdRef.current.size === 0) return;
    updateShopPlacemarkFocus();
  }, [mapReady, selectedShopId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncStartPm(map);
  }, [mapReady, manualMapStart, userLat, userLng, routeStartMode]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    syncUserPm(map);
  }, [mapReady, userLat, userLng, routeStartMode]);

  useEffect(() => {
    if (shopsOnly) return;
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const hasRouteTrigger =
      routeRefreshKey >= 1 || navigationKey >= 1 || Boolean(routeGpsAnchor);
    if (!hasRouteTrigger) return;
    if (!autoBuildRoute && !routeGpsAnchor) return;
    scheduleRouteBuild(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mapReady,
    navigationMode,
    navigationKey,
    routeRefreshKey,
    autoBuildRoute,
    routeGpsAnchor,
    fromNodeId,
    selectedShopId,
    manualMapStart,
    userLat,
    userLng,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setType(mapLayer);
  }, [mapReady, mapLayer]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !focusTarget) return;
    const d = applyMapDisplayOffset(stripMapDisplayOffset(focusTarget));
    map.setCenter([d.lat, d.lng], 16, { duration: 300 });
  }, [mapReady, focusToken]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !selectedShopId) return;
    if (lastCenterShopRef.current === selectedShopId) return;
    lastCenterShopRef.current = selectedShopId;
    const hit = propsRef.current.markers.find((m) => m.id === selectedShopId);
    if (!hit) return;
    const { lat, lng } = shopWgs84(hit);
    const d = applyMapDisplayOffset({ lat, lng });
    map.setCenter([d.lat, d.lng], 17, { duration: 300 });
  }, [mapReady, selectedShopId]);

  if (loadError && !onLoadFailed) {
    const referrers = yandexMapsReferrerPatterns();
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[#F4F5F7] p-6 text-center">
        <p className="max-w-md text-sm font-medium text-red-600">{loadError}</p>
        <p className="max-w-md text-xs text-ink-600">
          <a
            href="https://developer.tech.yandex.ru/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-[#1E98FF] hover:underline"
          >
            developer.tech.yandex.ru
          </a>
          {" "}
          → kalit → «HTTP referrer»:
        </p>
        <ul className="max-w-md list-inside list-disc text-left text-[11px] text-ink-500">
          {referrers.map((r) => (
            <li key={r}>
              <code className="rounded bg-white px-1">{r}</code>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            resetYandexMapsLoader();
            setLoadError(null);
            mountedRef.current = false;
            window.location.reload();
          }}
          className="rounded-lg bg-[#1E98FF] px-4 py-2 text-xs font-bold text-white"
        >
          Qayta yuklash
        </button>
      </div>
    );
  }

  if (loadError && onLoadFailed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#F4F5F7] p-4 text-center text-xs text-ink-500">
        Xarita zaxira rejimiga o‘tilmoqda…
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative h-full w-full min-h-0 overflow-hidden",
        pickStartOnMap ? "cursor-crosshair" : "",
        className,
      )}
    >
      <div
        ref={containerRef}
        className="yandex-market-map-host absolute inset-0 [&_.ymaps-2-1-map]:!touch-action-none"
      />
    </div>
  );
}
