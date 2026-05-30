"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getIndoorMarketMap, getMerchantHeatmap, updateMerchantIndoorStallPosition } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { snapStallCenterToGraph, type NavNode } from "@/lib/snap-grid";

type Stall = {
  id: string;
  stall_code: string;
  block_code: string;
  status: string;
  local_x: number;
  local_y: number;
  width: number;
  height: number;
  graph_node_id?: string;
  shop_id?: string | null;
};

type FloorLevel = {
  level: number;
  name: string;
  view_box: string;
  navigation_graph?: {
    nodes?: Record<string, { x?: number; y?: number; kind?: string }>;
  };
  stalls: Stall[];
};

type VisitorPin = {
  id: string;
  x: number;
  y: number;
  label?: string;
};

type StallMapEditorProps = {
  marketSlug?: string;
  precisionPin?: { x: number; y: number } | null;
  onPrecisionPinMove?: (point: { x: number; y: number }) => void;
  selectedBlock?: string;
  selectedStall?: string;
  myShopStallId?: string | null;
  /** Merchant shop UUID — faqat shu shopga biriktirilgan rasta silinadi */
  myShopId?: string | null;
  visitorPins?: VisitorPin[];
  readOnlyOverlay?: boolean;
};

function stallFill(stall: Stall, heat: number, isSelected: boolean, isMine: boolean): { fill: string; stroke: string; text: string } {
  if (isSelected || isMine) {
    return { fill: "#0066ff", stroke: "#0052cc", text: "#ffffff" };
  }
  if (heat > 0.5) {
    return { fill: "#ff4d12", stroke: "#e04410", text: "#ffffff" };
  }
  if (heat > 0.2) {
    return { fill: "#ffb899", stroke: "#ff4d12", text: "#7c2d12" };
  }
  if (stall.status === "occupied" || stall.shop_id) {
    return { fill: "#e8f1ff", stroke: "#0066ff", text: "#003d99" };
  }
  return { fill: "#ffffff", stroke: "#d8dee9", text: "#64748b" };
}

function MapLegend({ compact }: { compact?: boolean }) {
  const items = [
    { swatch: "bg-electric-500", label: "Sizning rastangiz" },
    { swatch: "bg-electric-500/15 border border-electric-500/40", label: "Band rasta" },
    { swatch: "bg-white border border-border-subtle", label: "Bo'sh" },
    { swatch: "bg-accent/80", label: "Ko'p tashrif (heatmap)" },
  ];
  return (
    <div className={cn("flex flex-wrap gap-x-4 gap-y-2", compact ? "text-[10px]" : "text-xs")}>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 text-text-400">
          <span className={cn("h-3 w-3 rounded", item.swatch)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DraggableStall({
  stall,
  heat,
  isSelected,
  isMine,
  navNodes,
  onSaved,
}: {
  stall: Stall;
  heat: number;
  isSelected: boolean;
  isMine: boolean;
  navNodes: NavNode[];
  onSaved: (stall: Stall) => void;
}) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState({ x: stall.local_x, y: stall.local_y });

  useEffect(() => {
    setPos({ x: stall.local_x, y: stall.local_y });
  }, [stall.local_x, stall.local_y]);

  const persist = useCallback(
    (next: Stall) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void updateMerchantIndoorStallPosition(stall.id, next.local_x, next.local_y, {
          snapToNearestNode: true,
          graphNodeId: next.graph_node_id,
        })
          .then(() => {
            toast.success("Rasta joyi saqlandi");
            onSaved(next);
          })
          .catch(() => toast.error("Faqat sizga biriktirilgan rastani siljita olasiz"));
      }, 500);
    },
    [onSaved, stall.id],
  );

  const colors = stallFill(stall, heat, isSelected, isMine);

  return (
    <motion.g
      drag={isMine}
      dragMomentum={false}
      dragElastic={0.04}
      style={{ x: pos.x, y: pos.y, cursor: isMine ? "grab" : "default" }}
      whileDrag={{ scale: 1.03, cursor: "grabbing" }}
      onDragEnd={(_, info) => {
        if (!isMine) return;
        const centerX = pos.x + stall.width / 2 + info.offset.x;
        const centerY = pos.y + stall.height / 2 + info.offset.y;
        const snapped = snapStallCenterToGraph(navNodes, centerX, centerY, stall.width, stall.height);
        const updated: Stall = {
          ...stall,
          local_x: snapped.localX,
          local_y: snapped.localY,
          graph_node_id: snapped.nodeId ?? stall.graph_node_id,
        };
        setPos({ x: updated.local_x, y: updated.local_y });
        persist(updated);
      }}
    >
      <rect
        x={0}
        y={0}
        width={stall.width}
        height={stall.height}
        rx={8}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth={isSelected || isMine ? 2 : 1}
        filter={isMine ? "url(#stall-shadow)" : undefined}
      />
      <text
        x={stall.width / 2}
        y={stall.height / 2 + 4}
        textAnchor="middle"
        fontSize="9"
        fontWeight={isMine || isSelected ? 700 : 500}
        fill={colors.text}
        pointerEvents="none"
      >
        {stall.block_code}-{stall.stall_code}
      </text>
    </motion.g>
  );
}

export function StallMapEditor({
  marketSlug = "ippodrom",
  precisionPin = null,
  onPrecisionPinMove,
  selectedBlock,
  selectedStall,
  myShopStallId = null,
  myShopId = null,
  visitorPins = [],
  readOnlyOverlay = false,
}: StallMapEditorProps) {
  const [levels, setLevels] = useState<FloorLevel[]>([]);
  const [level, setLevel] = useState(1);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallHeat, setStallHeat] = useState<Record<string, number>>({});
  const [draggingPin, setDraggingPin] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!getAccessToken()) return;
    const run = async () => {
      try {
        const [payload, heat] = await Promise.all([
          getIndoorMarketMap(marketSlug),
          getMerchantHeatmap(marketSlug, level),
        ]);
        setLevels(payload.levels);
        const active = payload.levels.find((item) => item.level === level) ?? payload.levels[0];
        setStalls(active?.stalls ?? []);
        const map: Record<string, number> = {};
        for (const row of heat.stalls ?? []) {
          map[row.stall_id] = row.intensity;
        }
        setStallHeat(map);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Xarita yuklanmadi");
      }
    };
    void run();
  }, [level, marketSlug]);

  const activeLevel = useMemo(() => levels.find((item) => item.level === level) ?? levels[0], [level, levels]);

  const navNodes: NavNode[] = useMemo(() => {
    const nodes = activeLevel?.navigation_graph?.nodes;
    if (!nodes) return [];
    return Object.entries(nodes).map(([id, meta]) => ({
      id,
      x: Number(meta?.x ?? 0),
      y: Number(meta?.y ?? 0),
      kind: meta?.kind,
    }));
  }, [activeLevel]);

  const toSvgPoint = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    return point.matrixTransform(matrix.inverse());
  };

  return (
    <section className={cn("crm-surface-card overflow-hidden", readOnlyOverlay ? "p-3" : "p-5")}>
      {!readOnlyOverlay ? (
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-electric-600">Xarita</p>
              <h2 className="text-lg font-bold text-text-100">Rasta xaritasi</h2>
              <p className="mt-1 max-w-lg text-sm text-text-400">
                O&apos;z rastangizni siljiting — mijozlar xaritada to&apos;g&apos;ri topadi. Ko&apos;k — sizning rasta.
              </p>
            </div>
            {levels.length > 1 ? (
              <div className="flex gap-1 rounded-2xl border border-border-subtle bg-elevated p-1">
                {levels.map((item) => (
                  <button
                    key={item.level}
                    type="button"
                    onClick={() => setLevel(item.level)}
                    className={cn(
                      "rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                      item.level === level
                        ? "bg-white text-text-100 shadow-sm"
                        : "text-text-400 hover:text-text-100",
                    )}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <MapLegend />
        </div>
      ) : (
        <MapLegend compact />
      )}

      <div className="overflow-hidden rounded-2xl border border-border-subtle bg-canvas">
        <svg
          ref={svgRef}
          viewBox={activeLevel?.view_box ?? "0 0 420 260"}
          className="h-auto w-full"
          role="img"
          aria-label="Bozor rasta xaritasi"
          onPointerMove={(e) => {
            if (!draggingPin) return;
            const p = toSvgPoint(e.clientX, e.clientY);
            if (p) onPrecisionPinMove?.(p);
          }}
          onPointerUp={() => setDraggingPin(false)}
        >
          <defs>
            <pattern id="grid-dots" width="16" height="16" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="#cbd5e1" opacity="0.5" />
            </pattern>
            <filter id="stall-shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#0066ff" floodOpacity="0.25" />
            </filter>
          </defs>
          <rect x="0" y="0" width="420" height="260" rx="16" fill="url(#grid-dots)" />
          <rect x="8" y="8" width="404" height="244" rx="12" fill="#f2f4f8" fillOpacity="0.92" />

          {navNodes
            .filter((n) => n.kind !== "stall")
            .map((node) => (
              <circle key={node.id} cx={node.x} cy={node.y} r={3} fill="#94a3b8" opacity={0.35} />
            ))}

          {!readOnlyOverlay
            ? stalls.map((stall) => {
                const isSelected =
                  selectedBlock === stall.block_code &&
                  selectedStall &&
                  stall.stall_code === selectedStall.padStart(2, "0");
                const isMine = myShopStallId
                  ? stall.id === myShopStallId
                  : Boolean(myShopId && stall.shop_id && stall.shop_id === myShopId);
                return (
                  <DraggableStall
                    key={stall.id}
                    stall={stall}
                    heat={stallHeat[stall.id] ?? 0}
                    isSelected={Boolean(isSelected)}
                    isMine={isMine}
                    navNodes={navNodes}
                    onSaved={(updated) => setStalls((cur) => cur.map((s) => (s.id === updated.id ? updated : s)))}
                  />
                );
              })
            : stalls.map((stall) => {
                const colors = stallFill(stall, 0, false, Boolean(stall.shop_id));
                return (
                  <g key={stall.id}>
                    <rect
                      x={stall.local_x}
                      y={stall.local_y}
                      width={stall.width}
                      height={stall.height}
                      rx={8}
                      fill={colors.fill}
                      stroke={colors.stroke}
                      strokeWidth={1}
                      opacity={0.9}
                    />
                  </g>
                );
              })}

          {visitorPins.map((pin) => (
            <g key={pin.id}>
              <circle cx={pin.x} cy={pin.y} r="14" fill="rgba(0,102,255,0.12)" />
              <circle cx={pin.x} cy={pin.y} r="7" fill="#0066ff" stroke="#fff" strokeWidth="2" />
              {pin.label ? (
                <text x={pin.x} y={pin.y - 12} textAnchor="middle" fontSize="9" fill="#003d99" fontWeight="700">
                  {pin.label}
                </text>
              ) : null}
            </g>
          ))}

          {precisionPin ? (
            <motion.g
              drag
              dragMomentum={false}
              onPointerDown={() => setDraggingPin(true)}
              style={{ cursor: "grab" }}
              whileDrag={{ scale: 1.08 }}
            >
              <circle cx={precisionPin.x} cy={precisionPin.y} r="16" fill="rgba(201,162,39,0.2)" />
              <circle cx={precisionPin.x} cy={precisionPin.y} r="9" fill="#C9A227" stroke="#ffffff" strokeWidth="2" />
              <text
                x={precisionPin.x}
                y={precisionPin.y - 16}
                textAnchor="middle"
                fontSize="10"
                fill="#8B6914"
                fontWeight="700"
              >
                Siz
              </text>
            </motion.g>
          ) : null}
        </svg>
      </div>

      {!readOnlyOverlay ? (
        <p className="mt-3 text-xs text-text-400">
          Faqat o&apos;z rastangizni sudrab siljiting. Boshqa rastalar qulflangan.
        </p>
      ) : null}
    </section>
  );
}
