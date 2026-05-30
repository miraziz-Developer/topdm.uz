"use client";

import { useEffect, useMemo, useState } from "react";

import { IndoorMapEngine } from "@/components/ui/indoor-map/indoor-map-engine";
import { getIndoorMarketMap, getIndoorRoute } from "@/lib/api";
import { getMarketPlan } from "@/lib/indoor-map/markets";
import { indoorMapResponseToPlan } from "@/lib/indoor-map/api-plan";
import type { IndoorMarketPlan, IndoorRoute } from "@/lib/indoor-map/types";
import { cn } from "@/lib/utils";

type ChatMiniMapProps = {
  marketSlug: string;
  level: number;
  startNodeId: string;
  goalNodeId: string;
  className?: string;
};

export function ChatMiniMap({ marketSlug, level, startNodeId, goalNodeId, className }: ChatMiniMapProps) {
  const [plan, setPlan] = useState<IndoorMarketPlan | null>(null);
  const [route, setRoute] = useState<IndoorRoute | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const payload = await getIndoorMarketMap(marketSlug);
        if (!cancelled) setPlan(indoorMapResponseToPlan(payload));
      } catch {
        if (!cancelled) setPlan(getMarketPlan(marketSlug));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketSlug]);

  useEffect(() => {
    if (!startNodeId || !goalNodeId) return;
    let cancelled = false;
    (async () => {
      try {
        const payload = await getIndoorRoute(marketSlug, level, startNodeId, goalNodeId);
        if (!cancelled) {
          setRoute({
            nodeIds: payload.node_ids,
            points: payload.points,
            distance: payload.distance,
          });
        }
      } catch {
        if (!cancelled) setRoute(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [marketSlug, level, startNodeId, goalNodeId]);

  const levelPlan = useMemo(() => plan?.levels.find((l) => l.level === level) ?? plan?.levels[0], [plan, level]);
  const goalPoint = useMemo(() => {
    if (!levelPlan || !goalNodeId) return null;
    const node = levelPlan.graph.nodes[goalNodeId];
    return node ? { x: node.x, y: node.y } : null;
  }, [levelPlan, goalNodeId]);

  if (loading || !plan || !levelPlan) {
    return <MapLoading className={className} />;
  }

  return (
    <div className={cn("mt-3", className)}>
      <IndoorMapEngine
        plan={plan}
        level={levelPlan.level}
        routeOverride={route}
        markers={
          goalPoint
            ? [
                {
                  id: "target",
                  name: "Do'kon",
                  point: goalPoint,
                  graphNodeId: goalNodeId,
                  isTarget: true,
                },
              ]
            : []
        }
        activeMarkerId="target"
        className="rounded-xl border border-border-subtle bg-white p-2"
      />
    </div>
  );
}

function MapLoading({ className }: { className?: string }) {
  return <div className={cn("mt-3 h-40 animate-pulse rounded-xl bg-surface", className)} />;
}
