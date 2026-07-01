"use client";

import { Bell, Package } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";
import { getOrderNotifications, markOrderNotificationsRead, type OrderNotification } from "@/lib/api";
import { requestOrdersRefresh } from "@/lib/orders-refresh-bus";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";

export function OrderNotificationsBell({ className }: { className?: string }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const hydrated = useAuthStore((s) => s.hydrated);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pulse, setPulse] = useState(false);
  const prevUnread = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!isLoggedIn) {
      setItems([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await getOrderNotifications(false);
      setItems(res.items ?? []);
      const unread = res.unread_count ?? 0;
      if (unread > prevUnread.current && prevUnread.current >= 0) {
        setPulse(true);
        requestOrdersRefresh();
        window.setTimeout(() => setPulse(false), 2400);
      }
      prevUnread.current = unread;
      setUnreadCount(unread);
    } catch {
      // silent — bell optional
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!hydrated) return;
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(timer);
  }, [hydrated, load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAllRead = async () => {
    if (!unreadCount) return;
    try {
      await markOrderNotificationsRead({ mark_all: true });
      await load();
    } catch {
      // ignore
    }
  };

  if (!hydrated || !isLoggedIn) return null;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
          pulse
            ? "border-electric-500/40 bg-electric-500/10 text-electric-700"
            : unreadCount > 0
              ? "border-electric-500/35 bg-sky-50 text-electric-700 hover:bg-sky-100"
              : "border-border-default text-ink-700 hover:border-electric-500/40 hover:text-electric-500",
        )}
        aria-label="Buyurtma bildirishnomalari"
      >
        <Bell className="h-[1.1rem] w-[1.1rem]" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-electric-600 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-[60] w-[min(92vw,22rem)] overflow-hidden rounded-2xl border border-border-subtle bg-white shadow-xl"
          >
            <div className="flex items-center justify-between border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-bold text-ink-900">Bildirishnomalar</p>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="text-[11px] font-semibold text-electric-600 hover:underline"
                >
                  O&apos;qilgan deb belgilash
                </button>
              ) : null}
            </div>
            <div className="max-h-80 overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-xs text-ink-500">Hozircha yangilik yo&apos;q</p>
              ) : (
                items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/orders?order=${item.order_id}`}
                    onClick={() => {
                      void markOrderNotificationsRead({ notification_ids: [item.id] });
                      setOpen(false);
                    }}
                    className={cn(
                      "block border-b border-border-subtle/70 px-4 py-3 transition hover:bg-electric-500/[0.04]",
                      !item.read && "bg-amber-50/60",
                      item.highlight && !item.read && "ring-1 ring-inset ring-amber-300/50",
                    )}
                  >
                    <div className="flex gap-2">
                      <Package className="mt-0.5 h-4 w-4 shrink-0 text-electric-600" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-900">{item.title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{item.body}</p>
                        <p className="mt-1 truncate text-[11px] font-medium text-ink-400">{item.product_name}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
            <div className="border-t border-border-subtle p-2">
              <Link href="/orders" onClick={() => setOpen(false)}>
                <Button size="sm" variant="secondary" className="w-full">
                  Buyurtmalarim
                </Button>
              </Link>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
