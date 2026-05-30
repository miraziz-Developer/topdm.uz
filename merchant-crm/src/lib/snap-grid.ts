export type NavNode = { id: string; x: number; y: number; kind?: string };

export function snapPointToGrid(x: number, y: number, step = 8): { x: number; y: number } {
  return { x: Math.round(x / step) * step, y: Math.round(y / step) * step };
}

export function nearestNavNode(nodes: NavNode[], x: number, y: number): NavNode | null {
  const preferred = nodes.filter((n) => n.kind !== "stall");
  const pool = preferred.length ? preferred : nodes;
  if (!pool.length) return null;
  return pool.reduce((best, node) => {
    const d = Math.hypot(node.x - x, node.y - y);
    const bestD = Math.hypot(best.x - x, best.y - y);
    return d < bestD ? node : best;
  });
}

export function snapStallCenterToGraph(
  nodes: NavNode[],
  centerX: number,
  centerY: number,
  stallWidth: number,
  stallHeight: number,
  step = 8,
): { localX: number; localY: number; nodeId: string | null } {
  const grid = snapPointToGrid(centerX, centerY, step);
  const nearest = nearestNavNode(nodes, grid.x, grid.y);
  const anchorX = nearest?.x ?? grid.x;
  const anchorY = nearest?.y ?? grid.y;
  return {
    localX: anchorX - stallWidth / 2,
    localY: anchorY - stallHeight / 2,
    nodeId: nearest?.id ?? null,
  };
}

export function heatGlowClass(intensity: number): string {
  if (intensity > 0.65) return "heatmap-hot";
  if (intensity > 0.35) return "heatmap-warm";
  if (intensity > 0.15) return "heatmap-mild";
  return "";
}
