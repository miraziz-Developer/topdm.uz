import { ippodromMarketPlan } from "@/lib/indoor-map/markets/ippodrom";
import type { IndoorMarketPlan } from "@/lib/indoor-map/types";

const abuSaxiyPlan: IndoorMarketPlan = {
  marketId: "abu-saxiy",
  slug: "abu-saxiy",
  name: "Abu Saxiy",
  levels: [
    {
      id: "abu-saxiy-level-1",
      level: 1,
      label: "1-qavat",
      viewBox: "0 0 420 260",
      blocks: [
        { id: "block-north", label: "Shimol", x: 24, y: 32, width: 170, height: 88 },
        { id: "block-south", label: "Janub", x: 24, y: 136, width: 170, height: 88 },
        { id: "block-east", label: "Sharq", x: 226, y: 32, width: 170, height: 192 },
      ],
      stalls: [],
      graph: {
        nodes: {
          "entrance-main": { id: "entrance-main", x: 210, y: 248, kind: "entrance" },
          "corridor-main": { id: "corridor-main", x: 210, y: 210, kind: "corridor" },
        },
        edges: [{ from: "entrance-main", to: "corridor-main", weight: 1 }],
      },
      entranceNodeId: "entrance-main",
    },
  ],
};

const dordoyPlan: IndoorMarketPlan = {
  marketId: "dordoy",
  slug: "dordoy",
  name: "Dordoy",
  levels: [
    {
      id: "dordoy-level-1",
      level: 1,
      label: "1-qavat",
      viewBox: "0 0 420 260",
      blocks: [
        { id: "block-red", label: "Qizil pavilon", x: 28, y: 36, width: 160, height: 180 },
        { id: "block-blue", label: "Ko'k pavilon", x: 232, y: 36, width: 160, height: 180 },
      ],
      stalls: [],
      graph: {
        nodes: {
          "entrance-main": { id: "entrance-main", x: 210, y: 248, kind: "entrance" },
          "corridor-main": { id: "corridor-main", x: 210, y: 210, kind: "corridor" },
        },
        edges: [{ from: "entrance-main", to: "corridor-main", weight: 1 }],
      },
      entranceNodeId: "entrance-main",
    },
  ],
};

const MARKET_PLANS: Record<string, IndoorMarketPlan> = {
  ippodrom: ippodromMarketPlan,
  "abu-saxiy": abuSaxiyPlan,
  dordoy: dordoyPlan,
};

export function getMarketPlan(marketIdOrSlug: string) {
  const key = marketIdOrSlug.toLowerCase();
  return MARKET_PLANS[key] ?? ippodromMarketPlan;
}

export function listMarketPlans() {
  return Object.values(MARKET_PLANS);
}

export function getMarketLevel(plan: IndoorMarketPlan, level: number) {
  return plan.levels.find((item) => item.level === level) ?? plan.levels[0];
}
