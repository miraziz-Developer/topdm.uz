import type { IndoorBlock, IndoorLevel, IndoorMarketPlan, IndoorStall, NavigationGraph, StallStatus } from "@/lib/indoor-map/types";

const BLOCKS = ["A", "B", "C", "D"] as const;
const STALL_CODES = ["08", "12", "16", "20", "24", "28"] as const;

function blockOrigin(index: number) {
  return 20 + index * 98;
}

function buildStalls(level: number, occupiedByBlock: Partial<Record<string, string[]>>): IndoorStall[] {
  const stalls: IndoorStall[] = [];

  BLOCKS.forEach((block, blockIndex) => {
    const xBase = blockOrigin(blockIndex);
    STALL_CODES.forEach((code, stallIndex) => {
      const row = Math.floor(stallIndex / 2);
      const col = stallIndex % 2;
      const x = xBase + 12 + col * 34;
      const y = 58 + row * 34;
      const occupied = occupiedByBlock[block]?.includes(code);
      stalls.push({
        id: `ippodrom-f${level}-${block}-${code}`,
        code,
        block,
        level,
        x,
        y,
        width: 28,
        height: 24,
        status: occupied ? "occupied" : "vacant",
        graphNodeId: `stall-${block}-${code}`,
      });
    });
  });

  return stalls;
}

function buildBlocks(): IndoorBlock[] {
  return BLOCKS.map((block, index) => ({
    id: `block-${block}`,
    label: `${block}-blok`,
    x: blockOrigin(index),
    y: 28,
    width: 82,
    height: 164,
  }));
}

function buildGraph(level: number, stalls: IndoorStall[]): NavigationGraph {
  const nodes: NavigationGraph["nodes"] = {};
  const edges: NavigationGraph["edges"] = [];

  BLOCKS.forEach((block, index) => {
    const centerX = blockOrigin(index) + 41;
    const entranceId = `entrance-${block}`;
    const corridorId = `corridor-${block}`;
    nodes[entranceId] = { id: entranceId, x: centerX, y: 248, kind: "entrance" };
    nodes[corridorId] = { id: corridorId, x: centerX, y: 206, kind: "corridor" };
    edges.push({ from: entranceId, to: corridorId, weight: 1.2 });

    if (index > 0) {
      const previousCorridor = `corridor-${BLOCKS[index - 1]}`;
      edges.push({ from: previousCorridor, to: corridorId, weight: 1.5 });
    }
  });

  for (const stall of stalls) {
  if (stall.level !== level) continue;
    const centerX = stall.x + stall.width / 2;
    const centerY = stall.y + stall.height / 2;
    nodes[stall.graphNodeId] = {
      id: stall.graphNodeId,
      x: centerX,
      y: centerY,
      kind: "stall",
    };
    edges.push({ from: `corridor-${stall.block}`, to: stall.graphNodeId, weight: 1 });
  }

  return { nodes, edges };
}

function buildLevel(level: number, label: string, occupiedByBlock: Partial<Record<string, string[]>>): IndoorLevel {
  const stalls = buildStalls(level, occupiedByBlock);
  const graph = buildGraph(level, stalls);
  return {
    id: `ippodrom-level-${level}`,
    level,
    label,
    viewBox: "0 0 420 260",
    blocks: buildBlocks(),
    stalls,
    graph,
    entranceNodeId: "entrance-A",
  };
}

export const ippodromMarketPlan: IndoorMarketPlan = {
  marketId: "ippodrom",
  slug: "ippodrom",
  name: "Ippodrom",
  levels: [
    buildLevel(1, "1-qavat", { A: ["08", "12"], B: ["16", "20"], C: ["24"], D: ["28"] }),
    buildLevel(2, "2-qavat", { A: ["12", "16"], B: ["08"], C: ["20", "24"], D: ["28"] }),
  ],
};

export function stallStatusColor(status: StallStatus) {
  return status === "occupied" ? "#0A7CFF" : "#e2e8f0";
}
