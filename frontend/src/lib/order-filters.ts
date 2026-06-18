import type { Order } from "@/types";

const ACTIVE_STATUSES = new Set(["pending", "reserved", "confirmed", "preparing", "ready"]);
const COMPLETED_STATUSES = new Set(["completed"]);
const CANCELLED_STATUSES = new Set(["cancelled"]);

export type OrderListScope = "active" | "completed" | "cancelled" | "all";

export function isActiveOrder(status: string): boolean {
  return ACTIVE_STATUSES.has(status);
}

export function isCompletedOrder(status: string): boolean {
  return COMPLETED_STATUSES.has(status);
}

export function isCancelledOrder(status: string): boolean {
  return CANCELLED_STATUSES.has(status);
}

export function filterOrdersByScope(orders: Order[], scope: OrderListScope): Order[] {
  if (scope === "all") return orders;
  if (scope === "active") return orders.filter((o) => isActiveOrder(o.status));
  if (scope === "completed") return orders.filter((o) => isCompletedOrder(o.status));
  return orders.filter((o) => isCancelledOrder(o.status));
}

export function sortOrdersNewestFirst(orders: Order[]): Order[] {
  return [...orders].sort((a, b) => {
    const ta = a.created_at ? Date.parse(a.created_at) : 0;
    const tb = b.created_at ? Date.parse(b.created_at) : 0;
    return tb - ta;
  });
}
