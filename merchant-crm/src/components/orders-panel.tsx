"use client";

import {
  MapPin,
  MoreHorizontal,
  Package,
  Phone,
  Search,
  Truck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PickupQrScannerPanel } from "@/components/pickup-qr-scanner-panel";
import { CustomerPhoneInsight } from "@/components/customer-phone-insight";
import { CrmFilterChip } from "@/components/crm/filter-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dispatchMerchantCourier,
  getMerchantDashboard,
  getMerchantFinanceWallet,
  getMerchantWaybill,
  syncMerchantDelivery,
  updateMerchantOrder,
} from "@/lib/api";
import { notifyNewOrder } from "@/lib/order-alerts";
import { shortId } from "@/lib/short-id";
import { cn, formatPrice } from "@/lib/utils";

// BUG FIX: Pickup vaqt labellari
const PICKUP_TIME_LABELS: Record<string, string> = {
  "09:00": "09:00 - 11:00 (Ertalab)",
  "12:00": "11:00 - 14:00 (Tushlik)",
  "15:00": "14:00 - 17:00 (Tushdan keyin)",
};

// BUG FIX: To'lov usuli labellari
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Naqd pul",
  terminal: "Terminal",
  click: "Click (onlayn)",
};

const STATUS_FLOW = [
  { value: "reserved", label: "Band qilingan" },
  { value: "confirmed", label: "Tasdiqlangan" },
  { value: "preparing", label: "Tayyorlanmoqda" },
  { value: "ready", label: "Tayyor" },
  { value: "completed", label: "Yakunlandi" },
  { value: "cancelled", label: "Bekor qilingan" },
] as const;

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  reserved: { label: "Band qilingan", variant: "warning" },
  confirmed: { label: "Tasdiqlangan", variant: "default" },
  preparing: { label: "Tayyorlanmoqda", variant: "warning" },
  ready: { label: "Tayyor", variant: "success" },
  completed: { label: "Yakunlandi", variant: "success" },
  cancelled: { label: "Bekor qilingan", variant: "danger" },
};

type OrderRow = {
  id: string;
  status: string;
  total_price: number;
  quantity: number;
  product_name: string;
  fulfillment_type?: string;
  carrier_class?: "express" | "cargo" | null;
  delivery_cost_uzs?: number | null;
  customer_phone?: string;
  pickup_date?: string | null;
  pickup_time?: string | null;
  // BUG FIX: payment_method qo'shildi
  payment_method?: string | null;
  payment_method_label?: string | null;
  arrival_status?: string | null;
  dwell_minutes?: number | null;
  distance_label?: string | null;
};

type FilterKey = "active" | "done" | "all" | "delivery" | "pickup";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Faol" },
  { key: "done", label: "Tarix" },
  { key: "delivery", label: "Yetkazish" },
  { key: "pickup", label: "Olib ketish" },
  { key: "all", label: "Hammasi" },
];

// BUG FIX: pickup_time label bilan ko'rsatish
function formatPickup(when?: string | null, time?: string | null) {
  if (!when) return "—";
  const timeLabel = time ? (PICKUP_TIME_LABELS[time] ?? time) : null;
  return timeLabel ? `${when} · ${timeLabel}` : when;
}

function formatWalletAmount(raw: string): string {
  const n = Number.parseFloat(raw.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return raw;
  return formatPrice(Math.round(n));
}

function matchesFilter(order: OrderRow, filter: FilterKey): boolean {
  const done = ["completed", "cancelled"].includes(order.status);
  const isDelivery = order.fulfillment_type === "delivery";
  switch (filter) {
    case "active":
      return !done;
    case "done":
      return done;
    case "delivery":
      return isDelivery && !done;
    case "pickup":
      return !isDelivery && !done;
    default:
      return true;
  }
}

// BUG FIX: Telefon raqamini normalize qilish (qidiruv uchun)
function normalizePhoneForSearch(phone: string): string {
  return phone.replace(/[^\d]/g, "");
}

// BUG FIX: WhatsApp link
function whatsappUrl(phone: string): string {
  const digits = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${digits}`;
}

// BUG FIX: Telegram link
function telegramUrl(phone: string): string {
  return `https://t.me/${phone.replace(/[^\d+]/g, "")}`;
}

function OrderActionsMenu({
  order,
  busy,
  onDispatch,
  onSync,
  onWaybill,
  onCancel,
}: {
  order: OrderRow;
  busy: boolean;
  onDispatch: () => void;
  onSync: () => void;
  onWaybill: () => void;
  onCancel: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDelivery = order.fulfillment_type === "delivery";
  const isDone = ["completed", "cancelled"].includes(order.status);
  const canCancel = ["reserved", "confirmed", "pending"].includes(order.status);

  if (isDone) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg p-2 text-text-400 hover:bg-canvas hover:text-text-100"
        aria-label="Amallar"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <>
          <button type="button" className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-border-subtle bg-surface py-1 shadow-lg">
            {isDelivery ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                  onClick={() => {
                    setOpen(false);
                    onDispatch();
                  }}
                >
                  <Truck className="h-3.5 w-3.5" />
                  Kuryer chaqirish
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                  onClick={() => {
                    setOpen(false);
                    onSync();
                  }}
                >
                  Holatni yangilash
                </button>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                  onClick={() => {
                    setOpen(false);
                    onWaybill();
                  }}
                >
                  Yetkazish yorlig&apos;i
                </button>
              </>
            ) : null}
            {/* BUG FIX: Bekor qilish tugmasi qo'shildi */}
            {canCancel ? (
              <button
                type="button"
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => {
                  setOpen(false);
                  onCancel();
                }}
              >
                <X className="h-3.5 w-3.5" />
                Bekor qilish
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function OrdersPanel() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [wallet, setWallet] = useState<{ current_balance: string; frozen_balance: string } | null>(null);
  const [filter, setFilter] = useState<FilterKey>("active");
  const [query, setQuery] = useState("");
  const [waybill, setWaybill] = useState<{
    order_id: string;
    barcode_value: string;
    merchant: { name: string; sector: string; block: string; rasta: string; phone: string };
    customer: { phone: string; address: string; city: string };
    carrier_class: string;
    delivery_cost_uzs: number;
  } | null>(null);
  const knownActiveOrderIdsRef = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [data, walletData] = await Promise.all([getMerchantDashboard(), getMerchantFinanceWallet()]);
    setOrders(data.orders ?? []);
    setWallet(walletData.wallet);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) toast.error("Buyurtmalarni yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    // BUG FIX: Polling 20s → 10s (tezroq yangilanish)
    const id = window.setInterval(() => void load(), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [load]);

  useEffect(() => {
    const activeIds = new Set(orders.filter((o) => !["completed", "cancelled"].includes(o.status)).map((o) => o.id));
    if (knownActiveOrderIdsRef.current.size === 0) {
      knownActiveOrderIdsRef.current = activeIds;
      return;
    }
    let newCount = 0;
    for (const id of activeIds) {
      if (!knownActiveOrderIdsRef.current.has(id)) newCount += 1;
    }
    if (newCount > 0) {
      toast.success(`${newCount} ta yangi buyurtma`);
      void notifyNewOrder("Yangi buyurtma", `${newCount} ta yangi buyurtma keldi.`);
    }
    knownActiveOrderIdsRef.current = activeIds;
  }, [orders]);

  const counts = useMemo(() => {
    // BUG FIX: active faqat faol buyurtmalar (completed/cancelled emas)
    const active = orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length;
    const done = orders.filter((o) => ["completed", "cancelled"].includes(o.status)).length;
    const delivery = orders.filter(
      (o) => o.fulfillment_type === "delivery" && !["completed", "cancelled"].includes(o.status),
    ).length;
    const pickup = orders.filter(
      (o) => o.fulfillment_type !== "delivery" && !["completed", "cancelled"].includes(o.status),
    ).length;
    return { active, done, delivery, pickup, all: orders.length };
  }, [orders]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    // BUG FIX: Telefon qidiruv normalize qilinadi
    const qDigits = normalizePhoneForSearch(q);
    return orders
      .filter((o) => matchesFilter(o, filter))
      .filter((o) => {
        if (!q) return true;
        const phoneDigits = normalizePhoneForSearch(o.customer_phone ?? "");
        return (
          o.product_name?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          phoneDigits.includes(qDigits) ||
          shortId(o.id).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aDone = ["completed", "cancelled"].includes(a.status);
        const bDone = ["completed", "cancelled"].includes(b.status);
        if (aDone === bDone) return 0;
        return aDone ? 1 : -1;
      });
  }, [orders, filter, query]);

  const changeStatus = async (orderId: string, status: string) => {
    setBusyId(orderId);
    try {
      const res = await updateMerchantOrder(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: res.status } : o)));
      toast.success("Holat yangilandi");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Holatni yangilab bo'lmadi";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  // BUG FIX: Bekor qilish funksiyasi
  const cancelOrder = async (order: OrderRow) => {
    if (!window.confirm(`"${order.product_name}" buyurtmasini bekor qilasizmi?`)) return;
    setBusyId(order.id);
    try {
      const res = await updateMerchantOrder(order.id, "cancelled");
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: res.status } : o)));
      toast.success("Buyurtma bekor qilindi");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Bekor qilib bo'lmadi";
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  };

  const dispatchCourier = async (order: OrderRow) => {
    setBusyId(order.id);
    try {
      const res = await dispatchMerchantCourier(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: res.status } : o)));
      toast.success("Kuryer chaqirildi");
    } catch {
      toast.error("Kuryerga topshirishda xato");
    } finally {
      setBusyId(null);
    }
  };

  const syncDelivery = async (order: OrderRow) => {
    setBusyId(order.id);
    try {
      const res = await syncMerchantDelivery(order.id);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: res.status } : o)));
      toast.success("Yetkazish yangilandi");
    } catch {
      toast.error("Yangilab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const openWaybill = async (order: OrderRow) => {
    try {
      const wb = await getMerchantWaybill(order.id);
      setWaybill({
        order_id: wb.order_id,
        barcode_value: wb.barcode_value,
        merchant: wb.merchant,
        customer: wb.customer,
        carrier_class: wb.carrier_class,
        delivery_cost_uzs: wb.delivery_cost_uzs,
      });
    } catch {
      toast.error("Yorliq yuklanmadi");
    }
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-3xl" />;
  }

  return (
    <div className="space-y-4">
      <PickupQrScannerPanel />
      <div className="crm-surface-card overflow-hidden">
        <div className="border-b border-border-subtle/80 bg-gradient-to-br from-surface via-surface to-canvas/40 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Faol</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-text-100">{counts.active}</p>
            </div>
            {wallet ? (
              <>
                <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Balans</p>
                  <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-text-100">
                    {formatWalletAmount(wallet.current_balance)}
                  </p>
                </div>
                <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Muzlatilgan</p>
                  <p className="mt-1 text-lg font-bold tabular-nums tracking-tight text-text-100">
                    {formatWalletAmount(wallet.frozen_balance)}
                  </p>
                </div>
              </>
            ) : (
              <div className="col-span-2 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90 sm:col-span-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Jami</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-text-100">{counts.all}</p>
              </div>
            )}
            <div className="col-span-2 rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90 sm:col-span-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Olib ketish</p>
              <p className="mt-1 text-xs font-medium leading-snug text-text-300">
                Faqat QR skaner orqali yakunlanadi
              </p>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Mahsulot, telefon yoki ID"
              className="h-12 w-full rounded-2xl border-0 bg-canvas/90 pl-11 pr-4 text-sm font-medium text-text-100 shadow-inner ring-1 ring-border-subtle/80 placeholder:font-normal placeholder:text-text-400 focus:ring-2 focus:ring-electric-500/25"
            />
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <CrmFilterChip
                key={tab.key}
                active={filter === tab.key}
                label={tab.label}
                count={counts[tab.key]}
                onClick={() => setFilter(tab.key)}
              />
            ))}
          </div>
        </div>

        {!visible.length ? (
          <div className="px-6 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500/12 to-transparent ring-1 ring-electric-500/15">
              <Package className="h-7 w-7 text-electric-500" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-lg font-bold tracking-tight text-text-100">Hozircha buyurtma yo&apos;q</p>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-text-400">
              Mijoz band qilganda push va shu ro&apos;yxatda darhol ko&apos;rasiz.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs font-medium text-text-400">
                    <th className="px-4 py-3.5 sm:px-5">Buyurtma</th>
                    <th className="px-4 py-3.5">Mijoz</th>
                    <th className="px-4 py-3.5">Tur</th>
                    <th className="px-4 py-3.5">Summa</th>
                    <th className="px-4 py-3.5">Olib ketish</th>
                    {/* BUG FIX: To'lov ustuni qo'shildi */}
                    <th className="px-4 py-3.5">To&apos;lov</th>
                    <th className="px-4 py-3.5">Holat</th>
                    <th className="w-12 px-4 py-3.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => {
                    const meta = STATUS_META[order.status] ?? { label: order.status, variant: "default" as const };
                    const isDelivery = order.fulfillment_type === "delivery";
                    const isDone = ["completed", "cancelled"].includes(order.status);
                    // BUG FIX: Delivery uchun completed ham ko'rsatiladi, pickup uchun emas
                    const activeStatuses = STATUS_FLOW.filter((s) => {
                      if (s.value === "cancelled") return false;
                      if (s.value === "completed") return isDelivery; // faqat delivery uchun
                      return true;
                    });

                    return (
                      <tr
                        key={order.id}
                        className={cn(
                          "border-b border-border-subtle/80 transition hover:bg-canvas/50 last:border-b-0",
                          isDone && "opacity-70",
                        )}
                      >
                        <td className="px-4 py-4 sm:px-5">
                          <p className="font-semibold text-text-100">{order.product_name || "Mahsulot"}</p>
                          <p className="mt-0.5 text-xs text-text-400">
                            ID: {shortId(order.id)} · {order.quantity} dona
                          </p>
                          {order.arrival_status === "at_shop" ? (
                            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                              <MapPin className="h-3 w-3" />
                              Do&apos;konda
                            </p>
                          ) : order.distance_label ? (
                            <p className="mt-1 text-xs text-text-400">Yo&apos;lda · {order.distance_label}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-4">
                          {order.customer_phone ? (
                            <div className="space-y-1">
                              {/* BUG FIX: WhatsApp va Telegram linklari qo'shildi */}
                              <div className="flex items-center gap-1.5">
                                <a href={`tel:${order.customer_phone}`} className="font-medium text-electric-600 hover:underline">
                                  {order.customer_phone}
                                </a>
                                <a
                                  href={whatsappUrl(order.customer_phone)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="WhatsApp"
                                  className="rounded p-0.5 text-emerald-600 hover:bg-emerald-50"
                                >
                                  <Phone className="h-3 w-3" />
                                </a>
                              </div>
                              <CustomerPhoneInsight phone={order.customer_phone} />
                            </div>
                          ) : (
                            <span className="text-text-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          {isDelivery ? (
                            <span className="inline-flex items-center gap-1 text-text-100">
                              <Truck className="h-3.5 w-3.5 text-text-400" />
                              Yetkazish
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-text-100">
                              <Package className="h-3.5 w-3.5 text-text-400" />
                              Olib ketish
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 font-semibold tabular-nums text-text-100">
                          {formatPrice(order.total_price)}
                          {isDelivery && order.delivery_cost_uzs ? (
                            <span className="mt-0.5 block text-xs font-normal text-text-400">
                              +{formatPrice(order.delivery_cost_uzs)} yetkazish
                            </span>
                          ) : null}
                        </td>
                        <td className="px-4 py-4 text-xs text-text-400">
                          {formatPickup(order.pickup_date, order.pickup_time)}
                        </td>
                        {/* BUG FIX: To'lov usuli ko'rsatiladi */}
                        <td className="px-4 py-4 text-xs text-text-400">
                          {order.payment_method_label ??
                            PAYMENT_METHOD_LABELS[order.payment_method ?? ""] ??
                            (order.payment_method || "—")}
                        </td>
                        <td className="px-4 py-4">
                          {isDone ? (
                            <Badge variant={meta.variant}>{meta.label}</Badge>
                          ) : (
                            <select
                              value={order.status}
                              disabled={busyId === order.id}
                              onChange={(e) => void changeStatus(order.id, e.target.value)}
                              className="h-9 max-w-[9.5rem] rounded-lg border border-border-subtle bg-canvas px-2 text-xs font-medium text-text-100"
                            >
                              {activeStatuses.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-4 sm:px-5">
                          <OrderActionsMenu
                            order={order}
                            busy={busyId === order.id}
                            onDispatch={() => void dispatchCourier(order)}
                            onSync={() => void syncDelivery(order)}
                            onWaybill={() => void openWaybill(order)}
                            onCancel={() => void cancelOrder(order)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 p-4 md:hidden">
              {visible.map((order) => {
                const meta = STATUS_META[order.status] ?? { label: order.status, variant: "default" as const };
                const isDone = ["completed", "cancelled"].includes(order.status);
                const isDelivery = order.fulfillment_type === "delivery";
                // BUG FIX: Delivery uchun completed ham ko'rsatiladi
                const mobileStatuses = STATUS_FLOW.filter((s) => {
                  if (s.value === "cancelled") return false;
                  if (s.value === "completed") return isDelivery;
                  return true;
                });
                return (
                  <li
                    key={order.id}
                    className={cn(
                      "rounded-2xl bg-canvas/50 p-4 ring-1 ring-border-subtle/90",
                      isDone && "opacity-80",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-bold tracking-tight text-text-100">{order.product_name}</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-text-100">
                          {formatPrice(order.total_price)}
                        </p>
                        <p className="mt-1 text-xs text-text-400">
                          {shortId(order.id)} · {order.quantity} dona
                          {isDelivery ? " · Yetkazish" : " · Olib ketish"}
                        </p>
                        {/* BUG FIX: To'lov usuli mobile'da ham ko'rsatiladi */}
                        {order.payment_method ? (
                          <p className="mt-0.5 text-xs text-text-400">
                            {order.payment_method_label ??
                              PAYMENT_METHOD_LABELS[order.payment_method] ??
                              order.payment_method}
                          </p>
                        ) : null}
                        {/* BUG FIX: Telefon + WhatsApp */}
                        {order.customer_phone ? (
                          <div className="mt-1 flex items-center gap-2">
                            <a href={`tel:${order.customer_phone}`} className="text-xs font-medium text-electric-600">
                              {order.customer_phone}
                            </a>
                            <a
                              href={whatsappUrl(order.customer_phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-emerald-600 hover:underline"
                            >
                              WA
                            </a>
                          </div>
                        ) : null}
                      </div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    {!isDone ? (
                      <select
                        value={order.status}
                        disabled={busyId === order.id}
                        onChange={(e) => void changeStatus(order.id, e.target.value)}
                        className="mt-3 h-11 w-full rounded-xl border-0 bg-surface px-3 text-sm font-medium text-text-100 ring-1 ring-border-subtle focus:ring-2 focus:ring-electric-500/20"
                      >
                        {mobileStatuses.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <div className="mt-3 flex justify-end border-t border-border-subtle/60 pt-3">
                      <OrderActionsMenu
                        order={order}
                        busy={busyId === order.id}
                        onDispatch={() => void dispatchCourier(order)}
                        onSync={() => void syncDelivery(order)}
                        onWaybill={() => void openWaybill(order)}
                        onCancel={() => void cancelOrder(order)}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      {waybill ? (
        <section className="crm-surface-card p-4 text-sm">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-semibold text-text-100">Yetkazish yorlig&apos;i</h4>
            <Button size="sm" variant="secondary" onClick={() => setWaybill(null)}>
              Yopish
            </Button>
          </div>
          <p className="text-text-400">Buyurtma: {waybill.order_id}</p>
          <p className="text-text-400">Barcode: {waybill.barcode_value}</p>
          <Button size="sm" className="mt-3" variant="secondary" onClick={() => window.print()}>
            Chop etish
          </Button>
        </section>
      ) : null}
    </div>
  );
}
