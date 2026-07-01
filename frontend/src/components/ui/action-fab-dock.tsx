"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SHOP_CHAT_OPEN_EVENT } from "@/lib/shop-chat-bus";
import { cn } from "@/lib/utils";

export type FabDockItem = {
  id: string;
  order: number;
  icon: ReactNode;
  label: string;
  shortLabel?: string;
  badge?: number;
  variant?: "default" | "gold" | "dark";
  pulse?: boolean;
  hidden?: boolean;
  onClick: () => void;
};

type FabDockContextValue = {
  register: (item: FabDockItem) => void;
  unregister: (id: string) => void;
  setPanelOpen: (id: string, open: boolean) => void;
};

const FabDockContext = createContext<FabDockContextValue | null>(null);

export function ActionFabDockProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, FabDockItem>>(new Map());
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set());
  const [shopChatOpen, setShopChatOpen] = useState(false);

  useEffect(() => {
    const onShopChat = (event: Event) => {
      setShopChatOpen(Boolean((event as CustomEvent<boolean>).detail));
    };
    window.addEventListener(SHOP_CHAT_OPEN_EVENT, onShopChat);
    return () => window.removeEventListener(SHOP_CHAT_OPEN_EVENT, onShopChat);
  }, []);

  const register = useCallback((item: FabDockItem) => {
    setItems((prev) => {
      const next = new Map(prev);
      next.set(item.id, item);
      return next;
    });
  }, []);

  const unregister = useCallback((id: string) => {
    setItems((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
    setOpenPanels((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const setPanelOpen = useCallback((id: string, open: boolean) => {
    setOpenPanels((prev) => {
      const next = new Set(prev);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ register, unregister, setPanelOpen }),
    [register, unregister, setPanelOpen],
  );

  const visible = useMemo(
    () =>
      [...items.values()]
        .filter((item) => !item.hidden)
        .sort((a, b) => a.order - b.order),
    [items],
  );

  const hideDock = openPanels.size > 0 || shopChatOpen;

  return (
    <FabDockContext.Provider value={value}>
      {children}
      <ActionFabDockRail items={visible} hidden={hideDock || visible.length === 0} />
    </FabDockContext.Provider>
  );
}

export function useFabDockItem(item: FabDockItem) {
  const ctx = useContext(FabDockContext);
  const onClickRef = useRef(item.onClick);
  onClickRef.current = item.onClick;

  useEffect(() => {
    if (!ctx) return;
    ctx.register({
      ...item,
      onClick: () => onClickRef.current(),
    });
    return () => ctx.unregister(item.id);
  }, [
    ctx,
    item.id,
    item.order,
    item.label,
    item.shortLabel,
    item.badge,
    item.hidden,
    item.variant,
    item.pulse,
    item.icon,
  ]);
}

export function useFabDockPanel(id: string, open: boolean) {
  const ctx = useContext(FabDockContext);
  useEffect(() => {
    if (!ctx) return;
    ctx.setPanelOpen(id, open);
    return () => ctx.setPanelOpen(id, false);
  }, [ctx, id, open]);
}

function DockButton({ item, layout }: { item: FabDockItem; layout: "bar" | "stack" }) {
  const badge = item.badge && item.badge > 0 ? item.badge : 0;

  return (
    <button
      type="button"
      onClick={item.onClick}
      aria-label={item.label}
      className={cn(
        "relative flex items-center justify-center transition-all duration-200 active:scale-[0.96]",
        layout === "bar"
          ? "min-h-[3rem] flex-1 gap-2 rounded-xl px-2 py-2"
          : "h-12 w-12 rounded-2xl",
        item.variant === "gold" &&
          "bg-gradient-to-br from-gold-400 via-gold-500 to-amber-600 text-white shadow-[0_4px_20px_-4px_rgba(245,158,11,0.55)]",
        item.variant === "dark" && "bg-ink-900 text-white shadow-md",
        item.variant === "default" || !item.variant
          ? layout === "bar"
            ? "text-ink-800 hover:bg-black/[0.04]"
            : "bg-white/90 text-ink-800 shadow-sm ring-1 ring-black/[0.06] hover:bg-white"
          : null,
      )}
    >
      <span className="relative shrink-0">{item.icon}</span>
      {layout === "bar" ? (
        <span className="truncate text-[11px] font-semibold leading-tight sm:text-xs">
          {item.shortLabel ?? item.label}
        </span>
      ) : null}
      {badge > 0 ? (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full font-bold text-white",
            layout === "bar" ? "-right-0.5 -top-0.5 h-4 min-w-[1rem] px-1 text-[9px]" : "-right-1 -top-1 h-5 min-w-[1.25rem] px-1 text-[10px]",
            item.variant === "gold" ? "bg-red-600" : "bg-neon-500",
          )}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
      {item.pulse && !badge ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold-400 opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold-500" />
        </span>
      ) : null}
    </button>
  );
}

function ActionFabDockRail({ items, hidden }: { items: FabDockItem[]; hidden: boolean }) {
  return (
    <AnimatePresence>
      {!hidden ? (
        <>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className={cn(
              "pointer-events-none fixed inset-x-0 z-[55] flex justify-center px-4 md:hidden",
              "bottom-[calc(var(--app-bottom-nav-h)+env(safe-area-inset-bottom,0px)+0.625rem)]",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto w-full max-w-[22rem]",
                "rounded-2xl border border-white/40 bg-white/88 p-1.5",
                "shadow-[0_12px_48px_-16px_rgba(15,23,42,0.35)] backdrop-blur-2xl",
                "ring-1 ring-black/[0.05]",
              )}
            >
              <div className="flex items-stretch gap-1">
                {items.map((item, index) => (
                  <div key={item.id} className="flex min-w-0 flex-1 items-center">
                    {index > 0 ? <div className="h-8 w-px shrink-0 bg-black/[0.08]" aria-hidden /> : null}
                    <DockButton item={item} layout="bar" />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", damping: 26, stiffness: 340 }}
            className={cn(
              "fab-safe-right pointer-events-none fixed z-[55] hidden md:block",
              "bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))]",
            )}
          >
            <div
              className={cn(
                "pointer-events-auto flex flex-col gap-2",
                "rounded-[1.75rem] border border-white/35 bg-white/82 p-2",
                "shadow-[0_16px_56px_-20px_rgba(15,23,42,0.4)] backdrop-blur-2xl",
                "ring-1 ring-black/[0.06]",
              )}
            >
              {items.map((item) => (
                <DockButton key={item.id} item={item} layout="stack" />
              ))}
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
