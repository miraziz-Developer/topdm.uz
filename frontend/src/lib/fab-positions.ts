/** O‘ng pastdagi FAB lar — nav + safe-area + AI/do‘kon stack. */

const fabRight = "fab-safe-right fixed z-50";

/** AI stylist (eng past) */
export const FAB_AI = `${fabRight} bottom-[calc(var(--app-bottom-nav-h)+env(safe-area-inset-bottom,0px)+0.5rem)] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))]`;

/** Do‘kon chat — AI ustida */
export const FAB_SHOP_CHAT = `fab-safe-right fixed z-40 bottom-[calc(var(--app-bottom-nav-h)+env(safe-area-inset-bottom,0px)+var(--app-fab-stack-gap))] md:bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))]`;
