"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { ArrowLeft, X } from "lucide-react";
import type { MapRef } from "react-map-gl/maplibre";

import { MarketMap, type MapEngine } from "@/components/map/market-map";
import type { YandexMapHandle } from "@/lib/map/yandex-map-handle";
import { applyMapDisplayOffset, stripMapDisplayOffset } from "@/lib/geo/market-geo";
import { MapRouteStatus } from "@/components/map/map-route-status";
import { MapFloatingControls } from "@/components/map/map-floating-controls";
import { MapSidebar } from "@/components/map/map-sidebar";
import { MapStoreSheet } from "@/components/map/map-store-sheet";
import { ShopMapPopupContent } from "@/components/map/shop-map-popup";
import { useIppodromMapPage, type MapFocusParams, type RouteStartMode } from "@/hooks/useIppodromMapPage";
import type { GeoLatLng } from "@/lib/geo/market-geo";
import { IPPODROM_CENTER } from "@/lib/geo/market-geo";
import {
  fitMapLibreToSpatialContent,
  flyMapLibreToVisiblePoint,
  MAPLIBRE_FOCUS_ZOOM,
} from "@/lib/map/maplibre-viewport";
import { formatMetersUz } from "@/lib/map/route-distance";
import { isYandexMapsApiEnabled, isYandexMapsPreferred } from "@/lib/map/yandex-maps-loader";
import { isSimpleMapMode } from "@/lib/map/simple-map-mode";
import {
  readStoredYandexMapLayer,
  storeYandexMapLayer,
  type YandexMapLayerId,
} from "@/lib/map/yandex-map-types";
import {
  DEFAULT_YANDEX_TRANSPORT,
  transportModeDistanceSuffix,
  type YandexTransportMode,
} from "@/lib/map/yandex-transport-modes";
import { NavigationFollowControl } from "@/components/map/navigation-follow-control";
import { YandexFloatingControls } from "@/components/map/yandex-floating-controls";
import { resolveMapChromeInsets } from "@/lib/map/spatial-viewport";
import { shouldAutoNavigateFromMapSource } from "@/lib/map/map-auto-navigate";
import {
  markerWgs84,
  openYandexNavigation,
  shopPageHref as resolveShopPageHref,
} from "@/lib/map/yandex-external";
import {
  createFollowRecenterGate,
  NAVIGATION_FOLLOW_ZOOM,
  shouldRecenterForFollow,
} from "@/lib/map/navigation-follow";
import { MarketSelector } from "@/components/map/market-selector";
import { normalizeMarketSlug } from "@/lib/map/market-catalog";
import { useToast } from "@/components/ui/toast";
import { postOrderApproachPing } from "@/lib/api";
import { readGuestPhone } from "@/lib/guest-phone";
import { resolveFocusMarkerFromQuery } from "@/lib/map-stores";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";
import { normalizeUzbekPhoneE164 } from "@/utils/phone-mask";
import { stallGraphNodeId } from "@/lib/shop-location";
import { cn } from "@/lib/utils";

function readFocusParams(searchParams: URLSearchParams): MapFocusParams {
  const latRaw = searchParams.get("lat");
  const lngRaw = searchParams.get("lng");
  return {
    merchantId: searchParams.get("merchant_id"),
    shopSlug: searchParams.get("shop"),
    block: searchParams.get("block"),
    stall: searchParams.get("stall"),
    lat: latRaw ? Number.parseFloat(latRaw) : null,
    lng: lngRaw ? Number.parseFloat(lngRaw) : null,
    focus: searchParams.get("focus") === "true",
    source: searchParams.get("source"),
    orderId: searchParams.get("order_id"),
  };
}

function destinationBannerForSource(
  source: string | null | undefined,
  externalYandex: boolean,
): string | null {
  if (source === "order") {
    return externalYandex
      ? "Buyurtmangiz do‘koni — Yandex Navigator’da marshrut"
      : "Buyurtmangiz do‘koni — yo‘l avtomatik chiziladi";
  }
  if (source === "product") {
    return externalYandex
      ? "Mahsulot do‘koni — Yandex’da ochish mumkin"
      : "Mahsulot do‘koni — GPS dan yo‘l chizilmoqda";
  }
  if (source === "search") {
    return externalYandex ? "Topilgan do‘kon — Yandex marshrut" : "Topilgan do‘kon — yo‘l avtomatik chiziladi";
  }
  if (source === "chat") return "Stilist tavsiya qilgan do‘kon";
  return null;
}

type IppodromMapExperienceProps = {
  mapTilerKey?: string;
};

function yandexFocusPointsForVisiblePin(
  marker: { lat: number; lng: number },
  chrome: { top: number; bottom: number },
): Array<{ lat: number; lng: number }> {
  const ratio = Math.max(0.08, Math.min(0.3, (chrome.bottom - chrome.top) / 900));
  const southAnchorLat = marker.lat - ratio * 0.0045;
  return [
    { lat: marker.lat, lng: marker.lng },
    { lat: southAnchorLat, lng: marker.lng },
  ];
}

export function IppodromMapExperience({ mapTilerKey = "" }: IppodromMapExperienceProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusParams = readFocusParams(searchParams);
  const [marketSlug, setMarketSlug] = useState(() => normalizeMarketSlug(searchParams.get("market")));
  const [mapRef, setMapRef] = useState<MapRef | null>(null);
  const [yandexMap, setYandexMap] = useState<YandexMapHandle | null>(null);
  const [mapEngine, setMapEngine] = useState<MapEngine | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => {
      const desktop = mq.matches;
      setIsDesktop(desktop);
      setSidebarOpen(desktop);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const {
    plan,
    level,
    setLevel,
    markers,
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
    manualMapStart,
    defaultFromNodeId,
    setFromNodeId,
    buildRouteFromPanel,
    locateUser,
    patchUserGps,
    userLat,
    userLng,
    userAccuracyM,
    routeStartMode,
    setRouteStartMode,
    addressQuery,
    setAddressQuery,
    addressLabel,
    setStartFromAddress,
    clearAddressStart,
    gpsError,
    setStartFromMapPoint,
    requestRoute,
    fetchStreetRouteForGoal,
    storesLoading,
    storesError,
    routeError,
    routeStartHint,
    reloadStores,
    clearManualMapStart,
  } = useIppodromMapPage(focusParams, marketSlug);

  const onMarketChange = useCallback(
    (slug: string) => {
      setMarketSlug(slug);
      const params = new URLSearchParams(searchParams.toString());
      params.set("market", slug);
      router.replace(`/map?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  const [gpsRefreshing, setGpsRefreshing] = useState(false);
  const [routeRefreshKey, setRouteRefreshKey] = useState(0);
  const [yandexDistanceM, setYandexDistanceM] = useState<number | null>(null);
  const [yandexRouteError, setYandexRouteError] = useState<string | null>(null);
  const [yandexMapLayer, setYandexMapLayer] = useState<YandexMapLayerId>("yandex#hybrid");
  const [yandexTrafficOn, setYandexTrafficOn] = useState(false);
  const [transportMode, setTransportMode] = useState<YandexTransportMode>(DEFAULT_YANDEX_TRANSPORT);
  const [navigationKey, setNavigationKey] = useState(0);
  const [navigationBusy, setNavigationBusy] = useState(false);
  const [autoNavRouteActive, setAutoNavRouteActive] = useState(false);
  const [followUserActive, setFollowUserActive] = useState(false);
  const followGateRef = useRef(createFollowRecenterGate());

  const autoYandexOpenedRef = useRef(false);
  const deepLinkShop = Boolean(
    focusParams.focus && (focusParams.merchantId || focusParams.shopSlug),
  );
  const shouldAutoNavigate = shouldAutoNavigateFromMapSource(focusParams.source);

  const expectedFocusMarker = useMemo(() => {
    if (!focusParams.focus || !markers.length) return null;
    return resolveFocusMarkerFromQuery(markers, {
      merchantId: focusParams.merchantId,
      shopSlug: focusParams.shopSlug,
      block: focusParams.block,
      stall: focusParams.stall,
    });
  }, [
    focusParams.focus,
    focusParams.merchantId,
    focusParams.shopSlug,
    focusParams.block,
    focusParams.stall,
    markers,
  ]);

  const focusShopMissing =
    deepLinkShop &&
    !storesLoading &&
    markers.length > 0 &&
    !expectedFocusMarker &&
    Boolean(focusParams.merchantId || focusParams.shopSlug);
  const simpleMap = isSimpleMapMode();
  const yandexMaps = isYandexMapsApiEnabled();
  const yandexEmbed = isYandexMapsPreferred() && yandexMaps;

  const destinationBanner = focusShopMissing
    ? "Do‘kon xaritada topilmadi — boshqa do‘konni tanlang"
    : destinationBannerForSource(focusParams.source, simpleMap);

  const [routeGpsAnchor, setRouteGpsAnchor] = useState<GeoLatLng | null>(null);
  const yandexAutoBuildRoute = simpleMap ? false : !deepLinkShop || routeRefreshKey > 0 || Boolean(routeGpsAnchor);
  const autoNavSeqRef = useRef(0);

  useEffect(() => {
    setYandexMapLayer(readStoredYandexMapLayer());
  }, []);

  useEffect(() => {
    autoNavSeqRef.current += 1;
    setAutoNavRouteActive(false);
    setNavigationKey(0);
    setRouteRefreshKey(0);
    setRouteGpsAnchor(null);
    setYandexRouteError(null);
    setYandexDistanceM(null);
    setFollowUserActive(false);
    followGateRef.current = createFollowRecenterGate();
    autoYandexOpenedRef.current = false;
  }, [focusParams.merchantId, focusParams.shopSlug, focusParams.source]);

  useEffect(() => {
    if (deepLinkShop && selectedMarker) {
      setSidebarOpen(true);
    }
  }, [deepLinkShop, selectedMarker?.id]);

  const bumpYandexRoute = useCallback(() => {
    setRouteRefreshKey((k) => k + 1);
  }, []);

  const mapChrome = useMemo(
    () =>
      resolveMapChromeInsets({
        sidebarOpen,
        hasBottomSheet: Boolean(popup && selectedMarker && !isDesktop),
        isDesktop,
      }),
    [sidebarOpen, popup, selectedMarker, isDesktop],
  );

  const displayRouteDistanceLabel = yandexMaps
    ? yandexDistanceM != null
      ? `≈ ${formatMetersUz(yandexDistanceM)} (${transportModeDistanceSuffix(transportMode)})`
      : null
    : routeDistanceLabel;

  const displayRouteError = yandexMaps ? yandexRouteError : routeError;
  const routePreviewReady =
    Boolean(selectedMarker) &&
    !displayRouteError &&
    (Boolean(displayRouteDistanceLabel) || autoNavRouteActive || routeRefreshKey > 0);

  /** Marshrut chizilgandan keyin «meni kuzatish» mavjud. */
  const navigationActive = routePreviewReady;

  const profilePhone = useUserStore((s) => s.profile?.phone);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const { push: toastPush } = useToast();
  const arrivalToastShown = useRef(false);

  useEffect(() => {
    const orderId = focusParams.orderId;
    if (!orderId || !navigationActive) return;

    const resolvePhone = () => {
      if (isLoggedIn && profilePhone) return normalizeUzbekPhoneE164(profilePhone);
      const guest = readGuestPhone();
      return guest ? normalizeUzbekPhoneE164(guest) : undefined;
    };

    const ping = () => {
      const phone = resolvePhone();
      if (!phone && userLat == null) return;
      void postOrderApproachPing(orderId, {
        phone,
        lat: userLat ?? undefined,
        lng: userLng ?? undefined,
        market_slug: marketSlug,
        level,
      })
        .then((res) => {
          if (res.arrival_detected && res.customer_message && !arrivalToastShown.current) {
            arrivalToastShown.current = true;
            toastPush(res.customer_message, "success");
          }
        })
        .catch(() => undefined);
    };

    ping();
    const timer = window.setInterval(ping, 90_000);
    return () => window.clearInterval(timer);
  }, [
    focusParams.orderId,
    navigationActive,
    userLat,
    userLng,
    marketSlug,
    level,
    profilePhone,
    isLoggedIn,
  ]);

  const centerMapOnUser = useCallback(
    (lat: number, lng: number, force = false) => {
      if (!shouldRecenterForFollow(followGateRef.current, lat, lng, force)) return;

      if (yandexMaps && yandexMap) {
        const d = applyMapDisplayOffset({ lat, lng });
        yandexMap.flyTo(d.lat, d.lng, NAVIGATION_FOLLOW_ZOOM);
        return;
      }
      if (mapRef) {
        mapRef.flyTo({
          center: [lng, lat],
          zoom: NAVIGATION_FOLLOW_ZOOM,
          duration: 480,
          essential: true,
          padding: {
            top: mapChrome.top,
            right: mapChrome.right,
            bottom: mapChrome.bottom,
            left: mapChrome.left,
          },
        });
      }
    },
    [yandexMaps, yandexMap, mapRef, mapChrome],
  );

  const handleMapUserInteract = useCallback(() => {
    setFollowUserActive(false);
  }, []);

  const handleToggleFollowUser = useCallback(() => {
    setFollowUserActive((wasOn) => {
      const next = !wasOn;
      if (next) {
        if (userLat != null && userLng != null) {
          centerMapOnUser(userLat, userLng, true);
        } else {
          void locateUser().then((fix) => {
            if (fix) centerMapOnUser(fix.lat, fix.lng, true);
          });
        }
      }
      return next;
    });
  }, [userLat, userLng, centerMapOnUser, locateUser]);

  const handleOpenYandexNavigation = useCallback(() => {
    if (!selectedMarker) return;
    const dest = markerWgs84(selectedMarker);
    const from =
      userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng)
        ? { lat: userLat, lng: userLng }
        : null;
    openYandexNavigation(dest, { mode: transportMode, from });
  }, [selectedMarker, userLat, userLng, transportMode]);

  const selectedShopHref = selectedMarker ? resolveShopPageHref(selectedMarker) : null;

  useEffect(() => {
    if (!simpleMap) return;
    clearManualMapStart();
  }, [simpleMap, clearManualMapStart]);

  useEffect(() => {
    if (!simpleMap || !shouldAutoNavigate || storesLoading || !markers.length) return;
    const target = expectedFocusMarker ?? selectedMarker;
    if (!target || !selectedMarker || selectedMarker.id !== target.id) return;
    if (autoYandexOpenedRef.current) return;
    autoYandexOpenedRef.current = true;
    const timer = window.setTimeout(() => handleOpenYandexNavigation(), 600);
    return () => window.clearTimeout(timer);
  }, [
    simpleMap,
    shouldAutoNavigate,
    storesLoading,
    markers.length,
    expectedFocusMarker,
    selectedMarker,
    handleOpenYandexNavigation,
  ]);

  useEffect(() => {
    if (simpleMap) return;
    if (!shouldAutoNavigate || storesLoading || !markers.length) return;

    const target = expectedFocusMarker ?? selectedMarker;
    if (!target) return;

    if (!selectedMarker || selectedMarker.id !== target.id) {
      selectShop(target);
      return;
    }

    if (!mapEngine) return;

    const seq = ++autoNavSeqRef.current;

    void (async () => {
      setGpsRefreshing(true);
      setRouteStartMode("gps");
      try {
        if (mapEngine === "yandex") {
          for (let i = 0; i < 60; i++) {
            if (seq !== autoNavSeqRef.current) return;
            if (yandexMap?.isMapReady()) break;
            await new Promise((r) => setTimeout(r, 200));
          }
          if (seq !== autoNavSeqRef.current) return;
          if (!yandexMap?.isMapReady()) {
            setYandexRouteError("Xarita yuklanmadi — sahifani yangilang yoki GPS ruxsatini tekshiring.");
            return;
          }
        }

        const fix = await locateUser();
        if (!fix || seq !== autoNavSeqRef.current) return;

        setRouteGpsAnchor({ lat: fix.lat, lng: fix.lng });
        patchUserGps(fix.lat, fix.lng, fix.accuracyM);
        setAutoNavRouteActive(true);

        const userWgs = { lat: fix.lat, lng: fix.lng };
        const shopWgs = stripMapDisplayOffset({ lat: target.lat, lng: target.lng });

        if (mapEngine === "yandex" && yandexMap) {
          const result = await yandexMap.buildRouteToShop({
            from: userWgs,
            shopId: target.id,
            mode: transportMode,
          });
          if (seq !== autoNavSeqRef.current) return;
          if (result.ok) {
            yandexMap.fitToPoints([userWgs, shopWgs]);
            setNavigationKey(1);
            setFollowUserActive(true);
            centerMapOnUser(fix.lat, fix.lng, true);
          } else if (result.error) {
            setYandexRouteError(result.error);
          }
          return;
        }

        if (mapRef) {
          mapRef.flyTo({
            center: [fix.lng, fix.lat],
            zoom: 15,
            duration: 900,
            essential: true,
            padding: {
              top: mapChrome.top,
              right: mapChrome.right,
              bottom: mapChrome.bottom,
              left: mapChrome.left,
            },
          });
          const street = await fetchStreetRouteForGoal(target, userWgs);
          if (seq !== autoNavSeqRef.current) return;
          if (street.ok) {
            setNavigationKey(1);
            setFollowUserActive(true);
            centerMapOnUser(fix.lat, fix.lng, true);
          } else {
            setYandexRouteError("Marshrut topilmadi — GPS yoki start nuqtasini tekshiring.");
          }
        }
      } finally {
        if (seq === autoNavSeqRef.current) {
          setGpsRefreshing(false);
        }
      }
    })();
  }, [
    shouldAutoNavigate,
    expectedFocusMarker,
    selectedMarker,
    storesLoading,
    markers.length,
    mapEngine,
    yandexMap,
    mapRef,
    mapChrome,
    locateUser,
    patchUserGps,
    setRouteStartMode,
    selectShop,
    fetchStreetRouteForGoal,
    transportMode,
    centerMapOnUser,
  ]);

  const focusToken = useMemo(
    () =>
      [
        focusParams.merchantId,
        focusParams.shopSlug,
        focusParams.block,
        focusParams.stall,
        focusParams.lat,
        focusParams.lng,
        selectedMarker?.id,
      ]
        .filter(Boolean)
        .join(":"),
    [focusParams, selectedMarker?.id],
  );

  const focusTarget = useMemo((): GeoLatLng | null => {
    if (!focusParams.focus) return null;
    if (
      focusParams.lat != null &&
      focusParams.lng != null &&
      Number.isFinite(focusParams.lat) &&
      Number.isFinite(focusParams.lng)
    ) {
      return { lat: focusParams.lat, lng: focusParams.lng };
    }
    if (selectedMarker) return { lat: selectedMarker.lat, lng: selectedMarker.lng };
    return null;
  }, [focusParams.focus, focusParams.lat, focusParams.lng, selectedMarker]);

  const handleMapReady = useCallback((map: MapRef | YandexMapHandle | null, engine: MapEngine) => {
    setMapEngine(map ? engine : null);
    if (engine === "yandex") {
      setYandexMap(map as YandexMapHandle | null);
      setMapRef(null);
      return;
    }
    setMapRef(map as MapRef | null);
    setYandexMap(null);
  }, []);

  const displayRoutePathSource = yandexMaps || streetRouteProvider === "yandex" ? ("osm" as const) : routePathSource;
  const displayStreetProvider = yandexMaps || streetRouteProvider === "yandex" ? "yandex" : streetRouteProvider;

  const handleSelectShop = useCallback(
    (marker: Parameters<typeof selectShop>[0]) => {
      selectShop(marker);
      setSidebarOpen(true);
      setNavigationKey(0);

      if (yandexEmbed && yandexMap) {
        yandexMap.fitToPoints(yandexFocusPointsForVisiblePin(marker, mapChrome));
        return;
      }

      if (mapRef) {
        flyMapLibreToVisiblePoint(
          mapRef,
          { lat: marker.lat, lng: marker.lng },
          MAPLIBRE_FOCUS_ZOOM,
          mapChrome,
        );
      }
    },
    [yandexEmbed, yandexMap, mapRef, mapChrome, selectShop],
  );

  const handleMyLocation = () => {
    void (async () => {
      setRouteStartMode("gps");
      const fix = await locateUser();
      if (!fix) return;
      if (yandexMaps) {
        const d = applyMapDisplayOffset({ lat: fix.lat, lng: fix.lng });
        yandexMap?.flyTo(d.lat, d.lng, 17);
        if (navigationActive && followUserActive) {
          centerMapOnUser(fix.lat, fix.lng, true);
        }
        if (!deepLinkShop || routeRefreshKey > 0) bumpYandexRoute();
        return;
      }
      if (mapRef) {
        mapRef.flyTo({
          center: [fix.lng, fix.lat],
          zoom: 17.6,
          duration: 1200,
          essential: true,
          padding: {
            top: mapChrome.top,
            right: mapChrome.right,
            bottom: mapChrome.bottom,
            left: mapChrome.left,
          },
        });
      }
      if (selectedMarker) {
        void requestRoute(stallGraphNodeId(selectedMarker.pin));
      }
    })();
  };

  const handleSidebarRefreshGps = () => {
    void (async () => {
      setGpsRefreshing(true);
      try {
        setRouteStartMode("gps");
        const fix = await locateUser();
        if (!fix) return;
        setRouteGpsAnchor({ lat: fix.lat, lng: fix.lng });
        if (yandexMaps) {
          const d = applyMapDisplayOffset({ lat: fix.lat, lng: fix.lng });
          yandexMap?.flyTo(d.lat, d.lng, 17);
          bumpYandexRoute();
          setNavigationKey((k) => k + 1);
        } else if (selectedMarker) {
          void requestRoute(stallGraphNodeId(selectedMarker.pin));
        }
      } finally {
        setGpsRefreshing(false);
      }
    })();
  };

  const handleRouteStartModeChange = useCallback((mode: RouteStartMode) => {
    if (mode === "stall") return;
    setRouteStartMode(mode);
  }, [setRouteStartMode]);

  const handleYandexLayerChange = useCallback(
    (layer: YandexMapLayerId) => {
      storeYandexMapLayer(layer);
      setYandexMapLayer(layer);
      yandexMap?.setMapLayer(layer);
    },
    [yandexMap],
  );

  const handleYandexTrafficToggle = useCallback(() => {
    const next = !yandexTrafficOn;
    try {
      yandexMap?.setTrafficVisible(next);
      setYandexTrafficOn(next);
    } catch {
      setYandexTrafficOn(false);
    }
  }, [yandexMap, yandexTrafficOn]);

  const handleBuildRoute = () => {
    setNavigationKey(0);
    if (!selectedMarker) return;

    if (yandexMaps && yandexMap) {
      void (async () => {
        let from: GeoLatLng | null = null;
        if (routeStartMode === "gps") {
          if (userLat != null && userLng != null) {
            from = { lat: userLat, lng: userLng };
          } else {
            const fix = await locateUser();
            if (fix) from = { lat: fix.lat, lng: fix.lng };
          }
        }
        if (from) {
          setRouteGpsAnchor(from);
          const result = await yandexMap.buildRouteToShop({
            from,
            shopId: selectedMarker.id,
            mode: transportMode,
          });
          if (result.ok) setNavigationKey(1);
          return;
        }
        bumpYandexRoute();
      })();
      return;
    }
    buildRouteFromPanel();
  };

  const handleStartNavigation = useCallback(() => {
    if (!selectedMarker) return;
    setNavigationBusy(true);
    setFollowUserActive(true);
    setNavigationKey((k) => k + 1);
    if (userLat != null && userLng != null) {
      centerMapOnUser(userLat, userLng, true);
    } else {
      void locateUser().then((fix) => {
        if (fix) centerMapOnUser(fix.lat, fix.lng, true);
      });
    }
    setTimeout(() => setNavigationBusy(false), 1200);
  }, [selectedMarker, userLat, userLng, centerMapOnUser, locateUser]);

  const handleTransportModeChange = useCallback((mode: YandexTransportMode) => {
    setTransportMode(mode);
    setNavigationKey(0);
  }, []);

  const handleFromNodeChange = useCallback(
    (nodeId: string) => {
      setFromNodeId(nodeId);
      if (yandexMaps && (!deepLinkShop || routeRefreshKey > 0)) bumpYandexRoute();
    },
    [setFromNodeId, yandexMaps, bumpYandexRoute, deepLinkShop, routeRefreshKey],
  );

  const handleYandexRouteCalculated = useCallback(
    (info: { distanceM: number | null; error: string | null }) => {
      setYandexDistanceM(info.distanceM);
      setYandexRouteError(info.error);
      if (shouldAutoNavigate && !info.error && info.distanceM != null) {
        setAutoNavRouteActive(true);
        setNavigationKey((k) => (k > 0 ? k : 1));
        setFollowUserActive(true);
      }
    },
    [shouldAutoNavigate],
  );

  const handlePickStartPoint = useCallback(
    (lat: number, lng: number) => {
      if (routeStartMode === "stall") return;
      setRouteStartMode("entrance");
      setStartFromMapPoint(lat, lng);
      if (yandexMaps && selectedMarker && (!deepLinkShop || routeRefreshKey > 0)) {
        bumpYandexRoute();
        return;
      }
      if (selectedMarker) {
        void requestRoute(stallGraphNodeId(selectedMarker.pin));
      }
    },
    [
      routeStartMode,
      setRouteStartMode,
      setStartFromMapPoint,
      selectedMarker,
      requestRoute,
      yandexMaps,
      deepLinkShop,
      routeRefreshKey,
      bumpYandexRoute,
    ],
  );

  const handleRecenterMarket = () => {
    if (yandexMaps && yandexMap) {
      if (markers.length) {
        yandexMap.fitToPoints(markers.map((m) => stripMapDisplayOffset({ lat: m.lat, lng: m.lng })));
      } else {
        yandexMap.flyTo(IPPODROM_CENTER.lat, IPPODROM_CENTER.lng, 17);
      }
      return;
    }
    if (!mapRef) return;
    if (markers.length) {
      fitMapLibreToSpatialContent(mapRef, { markers, chrome: mapChrome });
      return;
    }
    mapRef.flyTo({
      center: [IPPODROM_CENTER.lng, IPPODROM_CENTER.lat],
      zoom: 17,
      duration: 1200,
      essential: true,
    });
  };

  useEffect(() => {
    if (yandexMaps) return;
    const shouldWatch =
      Boolean(navigator.geolocation) &&
      (routeStartMode === "gps" || followUserActive || navigationActive);
    if (!shouldWatch) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        patchUserGps(lat, lng, pos.coords.accuracy);
        if (followUserActive && navigationActive) {
          centerMapOnUser(lat, lng);
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 15000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    routeStartMode,
    followUserActive,
    navigationActive,
    patchUserGps,
    centerMapOnUser,
    yandexMaps,
  ]);

  return (
    <div className="relative h-[calc(100vh-64px)] w-full overflow-hidden bg-[#F9FAFB] max-md:h-[100dvh]">
      <div className="absolute inset-0 z-0 h-full w-full">
        <MarketMap
          mapTilerKey={mapTilerKey}
          markers={markers}
          selectedShopId={selectedMarker?.id ?? null}
          fromNodeId={defaultFromNodeId}
          route={route}
          streetRoutePath={streetRoutePath}
          routeStartPoint={showRouteStartMarker ? routeStartDisplay : null}
          userLat={userLat}
          userLng={userLng}
          userAccuracyM={userAccuracyM}
          focusTarget={focusTarget}
          focusToken={focusToken}
          chrome={mapChrome}
          routeBusy={yandexMaps ? false : routeLoading || streetRouteLoading}
          showDestinationMarker={Boolean(selectedMarker)}
          routeStartMode={routeStartMode}
          manualMapStart={manualMapStart}
          routeRefreshKey={routeRefreshKey}
          yandexAutoBuildRoute={false}
          routeGpsAnchor={null}
          navigationKey={0}
          navigationMode={transportMode}
          yandexMapLayer={yandexMapLayer}
          onMapReady={handleMapReady}
          onSelectShop={handleSelectShop}
          onPickStartPoint={simpleMap ? undefined : handlePickStartPoint}
          onYandexRouteCalculated={handleYandexRouteCalculated}
          onMapUserInteract={handleMapUserInteract}
          pickStartOnMap={!simpleMap && routeStartMode !== "stall"}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col p-4 sm:p-6">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/80 text-ink-700 shadow-lg backdrop-blur-md transition hover:text-electric-500"
            aria-label="Orqaga"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className="pointer-events-auto rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-xs font-bold text-ink-700 shadow-lg backdrop-blur-md md:hidden"
          >
            {sidebarOpen ? "Panelni yopish" : "Qidiruv"}
          </button>
        </div>

        {!simpleMap ? (
          <MapRouteStatus
            className="pointer-events-none mx-auto mt-2 max-w-sm md:mx-0 md:max-w-[360px]"
            routeLoading={routeLoading}
            streetRouteLoading={streetRouteLoading}
            routeError={displayRouteError}
            storesError={storesError}
            storesLoading={storesLoading}
            markerCount={markers.length}
            onRetryStores={() => void reloadStores()}
            onRetryRoute={handleBuildRoute}
          />
        ) : storesError ? (
          <p className="pointer-events-auto mx-auto mt-2 max-w-sm rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-medium text-red-700">
            {storesError}
          </p>
        ) : null}

        <div className="mt-4 flex min-h-0 flex-1 flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div
            className={cn(
              "transition-all duration-300 md:block",
              sidebarOpen ? "block" : "hidden md:block",
            )}
          >
            <MarketSelector value={marketSlug} onChange={onMarketChange} className="mb-3 px-1" />
            <MapSidebar
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              searchBusy={searchBusy}
              markers={markers}
              selectedMarker={selectedMarker}
              onSelectShop={handleSelectShop}
              fromNodeId={defaultFromNodeId}
              onFromChange={handleFromNodeChange}
              onBuildRoute={handleBuildRoute}
              routeLoading={yandexMaps ? false : routeLoading}
              streetRouteLoading={yandexMaps ? false : streetRouteLoading}
              routeDistanceLabel={displayRouteDistanceLabel}
              routePathSource={displayRoutePathSource}
              streetRouteProvider={displayStreetProvider}
              routeStartMode={routeStartMode}
              onRouteStartModeChange={handleRouteStartModeChange}
              addressQuery={addressQuery}
              onAddressQueryChange={setAddressQuery}
              addressLabel={addressLabel}
              onAddressResolved={(hit) => {
                setStartFromAddress(hit);
                const display = applyMapDisplayOffset({ lat: hit.lat, lng: hit.lng });
                if (yandexMaps) {
                  yandexMap?.flyTo(display.lat, display.lng, 15);
                  bumpYandexRoute();
                } else if (mapRef) {
                  mapRef.flyTo({
                    center: [hit.lng, hit.lat],
                    zoom: 15,
                    duration: 900,
                    essential: true,
                    padding: {
                      top: mapChrome.top,
                      right: mapChrome.right,
                      bottom: mapChrome.bottom,
                      left: mapChrome.left,
                    },
                  });
                  if (selectedMarker) {
                    void requestRoute(stallGraphNodeId(selectedMarker.pin));
                  }
                }
              }}
              onClearAddress={clearAddressStart}
              onRefreshGps={handleSidebarRefreshGps}
              gpsRefreshing={gpsRefreshing}
              hasGpsFix={userLat != null && userLng != null}
              gpsError={gpsError}
              manualMapStart={manualMapStart}
              onClearMapStart={clearManualMapStart}
              routeError={displayRouteError}
              routeStartHint={routeStartHint}
              destinationBanner={destinationBanner}
              routePreviewReady={routePreviewReady}
              autoNavigating={shouldAutoNavigate && (gpsRefreshing || autoNavRouteActive)}
              yandexNavigation={yandexMaps}
              transportMode={transportMode}
              onTransportModeChange={handleTransportModeChange}
              onStartNavigation={handleStartNavigation}
              navigationBusy={navigationBusy}
              navigationActive={navigationActive}
              followUserActive={followUserActive}
              onToggleFollowUser={handleToggleFollowUser}
              externalYandexNav={simpleMap}
              onOpenYandexNav={handleOpenYandexNavigation}
              shopPageHref={selectedShopHref}
            />
          </div>
          {yandexEmbed ? (
            <YandexFloatingControls
              mapHandle={yandexMap}
              mapLayer={yandexMapLayer}
              onMapLayerChange={handleYandexLayerChange}
              trafficOn={yandexTrafficOn}
              onTrafficToggle={handleYandexTrafficToggle}
              onMyLocation={handleMyLocation}
              onRecenterMarket={handleRecenterMarket}
              className="mt-auto md:mt-0"
            />
          ) : (
            <MapFloatingControls
              mapRef={mapRef}
              levels={plan.levels}
              level={level}
              onLevelChange={setLevel}
              onMyLocation={handleMyLocation}
              onRecenterPlan={handleRecenterMarket}
              className="mt-auto md:mt-0"
            />
          )}
        </div>
      </div>

      {navigationActive && !simpleMap ? (
        <div
          className={cn(
            "pointer-events-none absolute z-20 flex justify-end",
            "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-3 max-md:left-3 max-md:justify-center",
            "md:bottom-6 md:right-auto md:left-[min(420px,calc(100%-1rem))]",
          )}
        >
          <NavigationFollowControl
            active={followUserActive}
            onToggle={handleToggleFollowUser}
            className="md:hidden"
          />
        </div>
      ) : null}

      {popup && selectedMarker ? (
        <div
          className={cn(
            "pointer-events-none absolute z-20 max-w-[min(100%,340px)] max-md:hidden",
            "bottom-6 right-4",
            sidebarOpen ? "md:right-4 md:bottom-6" : "md:right-6 md:bottom-8",
          )}
        >
          <div className="pointer-events-auto relative max-h-[min(70vh,520px)] overflow-y-auto overflow-x-hidden rounded-3xl border border-white/75 bg-gradient-to-br from-white/92 via-white/88 to-electric-500/[0.06] shadow-2xl backdrop-blur-2xl animate-in fade-in slide-in-from-bottom-3 duration-300">
            <button
              type="button"
              onClick={() => setPopup(null)}
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink-500 shadow-sm"
              aria-label="Yopish"
            >
              <X className="h-4 w-4" />
            </button>
            <ShopMapPopupContent data={popup} />
          </div>
        </div>
      ) : null}

      <AnimatePresence>
        {popup && selectedMarker ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 md:hidden">
            <MapStoreSheet data={popup} onClose={() => setPopup(null)} />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
