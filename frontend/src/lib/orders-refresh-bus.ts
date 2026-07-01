export const ORDERS_REFRESH_EVENT = "bozor:orders-refresh";

export function requestOrdersRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ORDERS_REFRESH_EVENT));
}
