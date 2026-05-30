export type StallStatus = "vacant" | "occupied";

export type MapPoint = {
  x: number;
  y: number;
};

export type NavigationNodeKind = "entrance" | "junction" | "stall" | "corridor";

export type NavigationNode = {
  id: string;
  x: number;
  y: number;
  kind: NavigationNodeKind;
};

export type NavigationEdge = {
  from: string;
  to: string;
  weight?: number;
};

export type NavigationGraph = {
  nodes: Record<string, NavigationNode>;
  edges: NavigationEdge[];
};

export type IndoorBlock = {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type IndoorStall = {
  id: string;
  code: string;
  block: string;
  level: number;
  x: number;
  y: number;
  width: number;
  height: number;
  status: StallStatus;
  shopId?: string;
  graphNodeId: string;
};

export type IndoorLevel = {
  id: string;
  level: number;
  label: string;
  viewBox: string;
  blocks: IndoorBlock[];
  stalls: IndoorStall[];
  graph: NavigationGraph;
  entranceNodeId: string;
};

export type IndoorMarketPlan = {
  marketId: string;
  slug: string;
  name: string;
  levels: IndoorLevel[];
};

export type IndoorRoute = {
  nodeIds: string[];
  points: MapPoint[];
  distance: number;
  startNodeId?: string;
  /** True GPS fix when route was built from device coordinates. */
  originGps?: { lat: number; lng: number } | null;
};
