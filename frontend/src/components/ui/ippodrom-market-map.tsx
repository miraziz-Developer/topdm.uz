"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { IndoorMapEngine } from "@/components/ui/indoor-map/indoor-map-engine";
import { LevelSwitcher } from "@/components/ui/indoor-map/level-switcher";
import { Button } from "@/components/ui/button";
import { getFeaturedShops, getIndoorMarketMap, getIndoorRoute, getIndoorRouteFromCoordinates } from "@/lib/api";
import { triggerHaptic } from "@/lib/haptics";
import { cacheIndoorMap, readCachedIndoorMap } from "@/lib/indoor-map/offline-cache";
import { indoorMapResponseToPlan } from "@/lib/indoor-map/api-plan";
import { getMarketPlan } from "@/lib/indoor-map/markets";
import { shopToMapMarker, stallGraphNodeId, type MapShopMarker } from "@/lib/shop-location";
import { useLocationStore } from "@/stores/location-store";
import type { IndoorMarketPlan, IndoorRoute } from "@/lib/indoor-map/types";
import type { ShopSummary } from "@/types";

type IppodromMarketMapProps = {
  targetShopId?: string;
  shops: ShopSummary[];
  className?: string;
  onShopSelect?: (shop: MapShopMarker) => void;
  routeDrawKey?: number;
  marketId?: string;
};

export function IppodromMarketMap({
  targetShopId,
  shops,
  className,
  onShopSelect,
  routeDrawKey = 0,
  marketId = "ippodrom",
}: IppodromMarketMapProps) {
  const [plan, setPlan] = useState<IndoorMarketPlan>(() => getMarketPlan(marketId));
  const [apiRoute, setApiRoute] = useState<IndoorRoute | null>(null);
  const [featuredIds, setFeaturedIds] = useState<Set<string>>(new Set());
  const currentBlock = useLocationStore((state) => state.currentBlock);
  const userLat = useLocationStore((state) => state.userLat);
  const userLng = useLocationStore((state) => state.userLng);
  const setCurrentBlock = useLocationStore((state) => state.setCurrentBlock);
  const markers = useMemo(() => shops.map((shop) => shopToMapMarker(shop)), [shops]);
  const [selectedId, setSelectedId] = useState<string | null>(targetShopId ?? null);
  const [focusedBlock, setFocusedBlock] = useState<string | null>(null);
  const [level, setLevel] = useState(1);
  const [perspective, setPerspective] = useState<"flat" | "isometric">("flat");

  const activeId = selectedId ?? targetShopId ?? markers[0]?.id ?? null;
  const activeMarker = markers.find((marker) => marker.id === activeId) ?? markers[0] ?? null;
  const visibleBlock = focusedBlock ?? activeMarker?.pin.block ?? currentBlock?.replace(/-blok/i, "").trim().charAt(0).toUpperCase() ?? "A";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const payload = await getIndoorMarketMap(marketId);
        cacheIndoorMap(marketId, payload);
        if (!cancelled) setPlan(indoorMapResponseToPlan(payload));
      } catch {
        const cached = readCachedIndoorMap(marketId);
        if (!cancelled) setPlan(cached ? indoorMapResponseToPlan(cached) : getMarketPlan(marketId));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getFeaturedShops({ market_slug: marketId });
        if (!cancelled) setFeaturedIds(new Set(res.items.map((s) => s.id)));
      } catch {
        if (!cancelled) setFeaturedIds(new Set());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketId]);

  const entranceNodeId = `entrance-${visibleBlock}`;
  const goalNodeId = activeMarker ? stallGraphNodeId(activeMarker.pin) : null;

  useEffect(() => {
    if (!goalNodeId) {
      setApiRoute(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const payload =
          userLat != null && userLng != null
            ? await getIndoorRouteFromCoordinates(marketId, level, {
                lat: userLat,
                lng: userLng,
                goal_node_id: goalNodeId,
              })
            : await getIndoorRoute(marketId, level, entranceNodeId, goalNodeId);
        if (!cancelled) {
          setApiRoute({
            nodeIds: payload.node_ids,
            points: payload.points,
            distance: payload.distance,
            startNodeId: payload.start_node_id,
          });
          triggerHaptic([8, 24, 8]);
        }
      } catch {
        if (!cancelled) setApiRoute(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketId, level, entranceNodeId, goalNodeId, routeDrawKey, userLat, userLng]);

  useEffect(() => {
    if (!activeMarker) return;
    setFocusedBlock(activeMarker.pin.block);
    setLevel(activeMarker.pin.floor);
  }, [activeMarker?.id, activeMarker?.pin.block, activeMarker?.pin.floor]);

  const selectShop = (marker: MapShopMarker) => {
    setSelectedId(marker.id);
    setFocusedBlock(marker.pin.block);
    setLevel(marker.pin.floor);
    setCurrentBlock(`${marker.pin.block}-blok`);
    onShopSelect?.(marker);
  };

  const indoorMarkers = markers.map((marker) => ({
    id: marker.id,
    name: marker.name,
    point: marker.point,
    graphNodeId: stallGraphNodeId(marker.pin),
    isTarget: marker.id === targetShopId,
  }));

  return (
    <motion.div className={className}>
      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-elevated/60 p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <LevelSwitcher levels={plan.levels} value={level} onChange={setLevel} />
          <button
            type="button"
            onClick={() => setPerspective((current) => (current === "flat" ? "isometric" : "flat"))}
            className="rounded-full border border-border-default px-3 py-1.5 text-xs font-medium text-ink-700 transition hover:border-electric-500/40"
          >
            {perspective === "flat" ? "2.5D ko'rinish" : "2D ko'rinish"}
          </button>
        </div>

        <div className="mb-2 flex items-center justify-between text-xs text-ink-500">
          <span>{level}-qavat</span>
          <span className="font-medium text-ink-700">
            {activeMarker ? `${activeMarker.pin.block}-blok • rasta ${activeMarker.pin.stall}` : "Do'konni tanlang"}
          </span>
        </div>

        <IndoorMapEngine
          plan={plan}
          level={level}
          focusedBlock={visibleBlock}
          markers={indoorMarkers}
          activeMarkerId={activeId}
          routeDrawKey={routeDrawKey}
          routeOverride={apiRoute}
          featuredShopIds={featuredIds}
          perspective={perspective}
          onBlockSelect={(block) => {
            setFocusedBlock(block);
            setCurrentBlock(`${block}-blok`);
          }}
          onMarkerSelect={(marker) => {
            const match = markers.find((item) => item.id === marker.id);
            if (match) selectShop(match);
          }}
        />
      </div>

      {activeMarker ? (
        <div className="mt-3 rounded-2xl border border-border-subtle bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-electric-500">Tanlangan do&apos;kon</p>
          <p className="mt-1 text-sm font-medium text-ink-700">
            {activeMarker.name} | {activeMarker.pin.block}-blok | rasta {activeMarker.pin.stall}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {activeMarker.slug ? (
              <Link href={`/shop/${activeMarker.slug}`}>
                <Button size="sm" variant="secondary">
                  Do&apos;konni ko&apos;rish
                </Button>
              </Link>
            ) : null}
            <Link href={`/search?q=${encodeURIComponent(activeMarker.name)}`}>
              <Button size="sm">Tovarlarni ko&apos;rish</Button>
            </Link>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
