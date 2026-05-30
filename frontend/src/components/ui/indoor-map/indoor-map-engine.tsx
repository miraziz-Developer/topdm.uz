"use client";

import { motion } from "framer-motion";
import { useId, useMemo } from "react";

import { isometricTransform } from "@/lib/indoor-map/isometric";
import { getMarketLevel } from "@/lib/indoor-map/markets";
import { stallStatusColor } from "@/lib/indoor-map/markets/ippodrom";
import { buildRoute } from "@/lib/indoor-map/pathfinding";
import { pointsToSvgPath } from "@/lib/indoor-map/path-geometry";
import type { IndoorMarketPlan, IndoorRoute, IndoorStall, MapPoint } from "@/lib/indoor-map/types";
import { cn } from "@/lib/utils";

export type IndoorMapMarker = {
  id: string;
  name: string;
  point: MapPoint;
  graphNodeId?: string;
  isTarget?: boolean;
};

type IndoorMapEngineProps = {
  plan: IndoorMarketPlan;
  level: number;
  focusedBlock?: string | null;
  markers?: IndoorMapMarker[];
  activeMarkerId?: string | null;
  routeDrawKey?: number;
  routeOverride?: IndoorRoute | null;
  featuredShopIds?: Set<string>;
  perspective?: "flat" | "isometric";
  editable?: boolean;
  onBlockSelect?: (blockId: string) => void;
  onStallSelect?: (stall: IndoorStall) => void;
  onMarkerSelect?: (marker: IndoorMapMarker) => void;
  onCanvasPick?: (point: MapPoint) => void;
  onStallMove?: (stallId: string, point: MapPoint) => void;
  className?: string;
};

function MarkerTooltip({ x, y, name }: { x: number; y: number; name: string }) {
  const width = Math.min(240, Math.max(96, name.length * 6.4 + 20));
  const height = name.length > 24 ? 36 : 26;

  return (
    <g pointerEvents="none">
      <foreignObject x={x - width / 2} y={y - height - 16} width={width} height={height}>
        <div className="flex h-full items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-center text-[10px] font-semibold leading-tight text-slate-900 shadow-sm">
          {name}
        </div>
      </foreignObject>
    </g>
  );
}

export function IndoorMapEngine({
  plan,
  level,
  focusedBlock,
  markers = [],
  activeMarkerId,
  routeDrawKey = 0,
  routeOverride,
  featuredShopIds,
  perspective = "flat",
  editable = false,
  onBlockSelect,
  onStallSelect,
  onMarkerSelect,
  onCanvasPick,
  onStallMove,
  className,
}: IndoorMapEngineProps) {
  const routeGradientId = useId().replace(/:/g, "");
  const routeFlowId = useId().replace(/:/g, "");
  const levelPlan = useMemo(() => getMarketLevel(plan, level), [plan, level]);
  const activeMarker = markers.find((marker) => marker.id === activeMarkerId) ?? markers[0] ?? null;

  const entranceNodeId = focusedBlock ? `entrance-${focusedBlock}` : levelPlan.entranceNodeId;
  const goalNodeId =
    activeMarker?.graphNodeId ??
    levelPlan.stalls.find((stall) => stall.shopId === activeMarker?.id)?.graphNodeId ??
    null;

  const route = useMemo(() => {
    if (routeOverride?.points?.length) return routeOverride;
    if (!goalNodeId) return null;
    return buildRoute(levelPlan.graph, entranceNodeId, goalNodeId);
  }, [entranceNodeId, goalNodeId, levelPlan.graph, routeOverride]);

  const snapNodeId =
    routeOverride?.startNodeId ??
    (route?.nodeIds?.length ? route.nodeIds[0] : entranceNodeId);

  const routePath = route ? pointsToSvgPath(route.points) : "";
  const isometric = perspective === "isometric";

  return (
    <motion.div className={className}>
      <motion.svg
        key={`${routeDrawKey}-${level}-${perspective}`}
        viewBox={levelPlan.viewBox}
        className="h-auto w-full"
        role="img"
        aria-label={`${plan.name} ichki xaritasi`}
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        onClick={(event) => {
          if (!onCanvasPick) return;
          const svg = event.currentTarget;
          const point = svg.createSVGPoint();
          point.x = event.clientX;
          point.y = event.clientY;
          const transformed = point.matrixTransform(svg.getScreenCTM()?.inverse());
          onCanvasPick({ x: transformed.x, y: transformed.y });
        }}
      >
        <defs>
          <linearGradient id={routeGradientId} x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#22c55e" />
            <stop offset="45%" stopColor="#0A7CFF" />
            <stop offset="100%" stopColor="#ff5a1f" />
          </linearGradient>
          <linearGradient id={routeFlowId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="420" height="260" rx="18" fill="#f7f7f8" />
        <rect x="16" y="228" width="388" height="20" rx="10" fill="#e8edf5" />
        <text x="24" y="242" fontSize="10" fill="#64748b">
          Kirish
        </text>

        <g transform={isometric ? isometricTransform() : undefined}>
          {levelPlan.blocks.map((block) => {
            const isFocused = focusedBlock ? block.label.startsWith(`${focusedBlock}-`) : false;
            return (
              <g
                key={block.id}
                className={onBlockSelect ? "cursor-pointer" : undefined}
                onClick={(event) => {
                  event.stopPropagation();
                  onBlockSelect?.(block.label.split("-")[0]);
                }}
              >
                <rect
                  x={block.x}
                  y={block.y}
                  width={block.width}
                  height={block.height}
                  rx="14"
                  fill={isFocused ? "rgba(59,130,246,0.12)" : "#ffffff"}
                  stroke={isFocused ? "#3b82f6" : "#e5e7eb"}
                  strokeWidth={isFocused ? 2 : 1.5}
                />
                <text x={block.x + block.width / 2} y={block.y + 20} textAnchor="middle" fontSize="12" fill="#111827" fontWeight="700">
                  {block.label}
                </text>
              </g>
            );
          })}

          {levelPlan.stalls.map((stall) => {
            const isTarget = goalNodeId === stall.graphNodeId;
            const isVip = stall.shopId ? featuredShopIds?.has(stall.shopId) : false;
            return (
              <g
                key={stall.id}
                className={cn(editable ? "cursor-grab active:cursor-grabbing" : onStallSelect ? "cursor-pointer" : undefined)}
                onClick={(event) => {
                  event.stopPropagation();
                  onStallSelect?.(stall);
                }}
              >
                {isTarget ? (
                  <>
                    <motion.rect
                      x={stall.x - 4}
                      y={stall.y - 4}
                      width={stall.width + 8}
                      height={stall.height + 8}
                      rx="10"
                      fill="none"
                      stroke="#0A7CFF"
                      strokeWidth="2"
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: [0.9, 0.2, 0.9], scale: [0.95, 1.08, 0.95] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    />
                    <motion.rect
                      x={stall.x - 8}
                      y={stall.y - 8}
                      width={stall.width + 16}
                      height={stall.height + 16}
                      rx="14"
                      fill="none"
                      stroke="#0A7CFF"
                      strokeWidth="1.5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 0.4, 0], scale: [0.9, 1.15, 0.9] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    />
                  </>
                ) : isVip ? (
                  <motion.rect
                    x={stall.x - 2}
                    y={stall.y - 2}
                    width={stall.width + 4}
                    height={stall.height + 4}
                    rx="8"
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.6, repeat: Infinity }}
                  />
                ) : null}
                <rect
                  x={stall.x}
                  y={stall.y}
                  width={stall.width}
                  height={stall.height}
                  rx="6"
                  fill={isTarget ? "#0A7CFF" : isVip ? "#f59e0b" : stallStatusColor(stall.status)}
                  stroke={isTarget ? "#0A7CFF" : isVip ? "#d97706" : stall.status === "occupied" ? "#93c5fd" : "#cbd5e1"}
                />
                <text
                  x={stall.x + stall.width / 2}
                  y={stall.y + stall.height / 2 + 4}
                  textAnchor="middle"
                  fontSize="9"
                  fill={isTarget || stall.status === "occupied" ? "#ffffff" : "#64748b"}
                >
                  {stall.code}
                </text>
              </g>
            );
          })}

          {routePath ? (
            <>
              <motion.path
                key={`route-${routeDrawKey}-${routePath}`}
                d={routePath}
                fill="none"
                stroke={`url(#${routeGradientId})`}
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={{ pathLength: 0, opacity: 0.35 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 1.2, ease: "easeOut", delay: 0.12 }}
              />
              <motion.path
                key={`route-flow-${routeDrawKey}-${routePath}`}
                d={routePath}
                fill="none"
                stroke={`url(#${routeFlowId})`}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 18"
                initial={{ pathLength: 0, opacity: 0.2 }}
                animate={{ pathLength: 1, opacity: 0.9, strokeDashoffset: [0, -56] }}
                transition={{
                  pathLength: { duration: 1.2, ease: "easeOut", delay: 0.2 },
                  strokeDashoffset: { duration: 2.4, repeat: Infinity, ease: "linear" },
                  opacity: { duration: 0.4, delay: 0.2 },
                }}
              />
            </>
          ) : null}

          {markers.map((marker) => {
            const isActive = marker.id === activeMarkerId;
            return (
              <g
                key={marker.id}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onMarkerSelect?.(marker);
                }}
              >
                {isActive ? (
                  <>
                    <motion.circle
                      cx={marker.point.x}
                      cy={marker.point.y}
                      fill={marker.isTarget ? "#ff5a1f" : "#0A7CFF"}
                      initial={{ r: 8, opacity: 0.45 }}
                      animate={{ r: [10, 18, 10], opacity: [0.45, 0, 0.45] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <MarkerTooltip x={marker.point.x} y={marker.point.y} name={marker.name} />
                  </>
                ) : null}
                <circle
                  cx={marker.point.x}
                  cy={marker.point.y}
                  r={isActive ? 9 : 7}
                  fill={marker.isTarget ? "#ff5a1f" : isActive ? "#0A7CFF" : "#94a3b8"}
                  stroke="#ffffff"
                  strokeWidth="2"
                />
              </g>
            );
          })}

          {snapNodeId && levelPlan.graph.nodes[snapNodeId] ? (
            <>
              <circle
                cx={levelPlan.graph.nodes[snapNodeId].x}
                cy={levelPlan.graph.nodes[snapNodeId].y}
                r="7"
                fill="#0A7CFF"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <motion.circle
                cx={levelPlan.graph.nodes[snapNodeId].x}
                cy={levelPlan.graph.nodes[snapNodeId].y}
                r="10"
                fill="#0A7CFF"
                fillOpacity="0.25"
                animate={{ r: [10, 22, 10], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.circle
                cx={levelPlan.graph.nodes[snapNodeId].x}
                cy={levelPlan.graph.nodes[snapNodeId].y}
                r="14"
                fill="none"
                stroke="#0A7CFF"
                strokeWidth="2"
                animate={{ opacity: [0.7, 0.15, 0.7], r: [14, 20, 14] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </>
          ) : null}
        </g>
      </motion.svg>
    </motion.div>
  );
}
