/** Do'kon chat ochiq/yopiq — boshqa FAB lar yashiriladi. */

export const SHOP_CHAT_OPEN_EVENT = "bozor:shop-chat-open";

export function setShopChatOpen(open: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SHOP_CHAT_OPEN_EVENT, { detail: open }));
}
