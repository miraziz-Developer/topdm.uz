import type { IndoorBlock, IndoorLevel, IndoorMarketPlan, IndoorStall, NavigationGraph, StallStatus } from "@/lib/indoor-map/types";
import type { IndoorMarketMapResponse } from "@/lib/api";

const BLOCK_LABELS = ["A", "B", "C", "D"] as const;

function blockOrigin(index: number) {
  return 20 + index * 98;
}

function buildBlocksFromStalls(stalls: IndoorStall[]): IndoorBlock[] {
  const blocks = new Set(stalls.map((s) => s.block));
  const ordered = BLOCK_LABELS.filter((b) => blocks.has(b));
  return ordered.map((block, index) => ({
    id: `block-${block}`,
    label: `${block}-blok`,
    x: blockOrigin(index),
    y: 28,
    width: 82,
    height: 164,
  }));
}

function toGraph(raw: IndoorMarketMapResponse["levels"][0]["navigation_graph"] | null | undefined): NavigationGraph {
  if (!raw) {
    return { nodes: {}, edges: [] };
  }
  const nodes: NavigationGraph["nodes"] = {};
  for (const [id, node] of Object.entries(raw.nodes ?? {})) {
    nodes[id] = {
      id,
      x: node.x,
      y: node.y,
      kind: (node.kind as NavigationGraph["nodes"][string]["kind"]) || "junction",
    };
  }
  return {
    nodes,
    edges: (raw.edges ?? []).map((edge) => ({
      from: edge.from,
      to: edge.to,
      weight: edge.weight,
    })),
  };
}

function pickEntranceNodeId(graph: NavigationGraph): string {
  const entrance = Object.values(graph.nodes).find((n) => n.kind === "entrance");
  return entrance?.id ?? "entrance-A";
}

export function indoorMapResponseToPlan(payload: IndoorMarketMapResponse): IndoorMarketPlan {
  const levels: IndoorLevel[] = payload.levels.map((level) => {
    const stalls: IndoorStall[] = (level.stalls ?? []).map((stall) => ({
      id: stall.id,
      code: stall.stall_code,
      block: stall.block_code,
      level: level.level,
      x: stall.local_x,
      y: stall.local_y,
      width: stall.width,
      height: stall.height,
      status: (stall.status === "occupied" ? "occupied" : "vacant") as StallStatus,
      shopId: stall.shop_id ?? undefined,
      graphNodeId: stall.graph_node_id,
    }));
    const graph = toGraph(level.navigation_graph);
    return {
      id: `level-${level.level}`,
      level: level.level,
      label: level.name || `${level.level}-qavat`,
      viewBox: level.view_box || "0 0 420 260",
      blocks: buildBlocksFromStalls(stalls),
      stalls,
      graph,
      entranceNodeId: pickEntranceNodeId(graph),
    };
  });

  return {
    marketId: payload.market_id,
    slug: payload.slug,
    name: payload.name,
    levels,
  };
}
