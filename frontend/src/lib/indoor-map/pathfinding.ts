import type { MapPoint, NavigationGraph, NavigationNode, IndoorRoute } from "@/lib/indoor-map/types";

type QueueItem = {
  nodeId: string;
  score: number;
};

function heuristic(from: NavigationNode | undefined, to: NavigationNode | undefined) {
  if (!from || !to) return Number.POSITIVE_INFINITY;
  return Math.hypot(from.x - to.x, from.y - to.y);
}

function edgeWeight(graph: NavigationGraph, from: string, to: string) {
  const edge = graph.edges.find((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from));
  if (edge?.weight) return edge.weight;
  const a = graph.nodes[from];
  const b = graph.nodes[to];
  if (!a || !b) return Number.POSITIVE_INFINITY;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function neighbors(graph: NavigationGraph, nodeId: string) {
  const ids = new Set<string>();
  for (const edge of graph.edges) {
    if (edge.from === nodeId) ids.add(edge.to);
    if (edge.to === nodeId) ids.add(edge.from);
  }
  return [...ids];
}

function reconstructPath(cameFrom: Map<string, string>, current: string) {
  const path = [current];
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    path.unshift(current);
  }
  return path;
}

export function findShortestPath(graph: NavigationGraph | null | undefined, startId: string, goalId: string): string[] {
  if (!graph?.nodes || !graph.nodes[startId] || !graph.nodes[goalId]) return [];
  if (startId === goalId) return [startId];

  const open: QueueItem[] = [{ nodeId: startId, score: 0 }];
  const cameFrom = new Map<string, string>();
  const gScore = new Map<string, number>([[startId, 0]]);

  while (open.length > 0) {
    open.sort((a, b) => a.score - b.score);
    const current = open.shift()!.nodeId;
    if (current === goalId) return reconstructPath(cameFrom, current);

    for (const nextId of neighbors(graph, current)) {
      const tentative = (gScore.get(current) ?? Number.POSITIVE_INFINITY) + edgeWeight(graph, current, nextId);
      if (tentative >= (gScore.get(nextId) ?? Number.POSITIVE_INFINITY)) continue;
      cameFrom.set(nextId, current);
      gScore.set(nextId, tentative);
      const nextNode = graph.nodes[nextId];
      const goalNode = graph.nodes[goalId];
      const score = tentative + heuristic(nextNode, goalNode);
      if (!open.some((item) => item.nodeId === nextId)) open.push({ nodeId: nextId, score });
    }
  }

  return [];
}

export function buildRoute(
  graph: NavigationGraph | null | undefined,
  startId: string,
  goalId: string,
): IndoorRoute {
  if (!graph?.nodes) {
    return { nodeIds: [], points: [], distance: 0 };
  }
  const nodeIds = findShortestPath(graph, startId, goalId);
  const points: MapPoint[] = nodeIds
    .map((nodeId) => graph.nodes[nodeId])
    .filter(Boolean)
    .map((node) => ({ x: node.x, y: node.y }));

  let distance = 0;
  for (let index = 1; index < points.length; index += 1) {
    distance += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }

  return { nodeIds, points, distance };
}
