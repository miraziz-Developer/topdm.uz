"use client";

import {
  MapPin,
  MoreHorizontal,
  Package,
  PackageCheck,
  Search,
  Truck,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  confirmMerchantPickup,
  dispatchMerchantCourier,
  getMerchantDashboard,
  getMerchantFinanceWallet,
  getMerchantPickupSettings,
  getMerchantWaybill,
  patchMerchantPickupSettings,
  syncMerchantDelivery,
  updateMerchantOrder,
} from "@/lib/api";
import { notifyNewOrder } from "@/lib/order-alerts";
import { shortId } from "@/lib/short-id";
import { cn, formatPrice } from "@/lib/utils";

const STATUS_FLOW = [
  { value: "reserved", label: "Bron" },
  { value: "confirmed", label: "Tasdiq" },
  { value: "preparing", label: "Tayyorlanmoqda" },
  { value: "ready", label: "Tayyor" },
  { value: "completed", label: "Yakunlandi" },
  { value: "cancelled", label: "Bekor" },
] as const;

const STATUS_META: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  reserved: { label: "Bron", variant: "warning" },
  confirmed: { label: "Tasdiq", variant: "default" },
  preparing: { label: "Tayyorlanmoqda", variant: "warning" },
  ready: { label: "Tayyor", variant: "success" },
  completed: { label: "Yakunlandi", variant: "success" },
  cancelled: { label: "Bekor", variant: "danger" },
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

function formatPickup(when?: string | null, time?: string | null) {
  if (!when) return "—";
  return time ? `${when} · ${time}` : when;
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

function OrderActionsMenu({
  order,
  busy,
  onPickup,
  onDispatch,
  onSync,
  onWaybill,
}: {
  order: OrderRow;
  busy: boolean;
  onPickup: () => void;
  onDispatch: () => void;
  onSync: () => void;
  onWaybill: () => void;
}) {
  const [open, setOpen] = useState(false);
  const isDelivery = order.fulfillment_type === "delivery";
  const isDone = ["completed", "cancelled"].includes(order.status);

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
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-border-subtle bg-surface py-1 shadow-lg">
            {!isDelivery && order.status === "ready" ? (
              <button
                type="button"
                disabled={busy}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-canvas"
                onClick={() => {
                  setOpen(false);
                  onPickup();
                }}
              >
                <PackageCheck className="h-3.5 w-3.5" />
                Olib ketdi
              </button>
            ) : null}
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
                  AWB yorliq
                </button>
              </>
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
  const [autoComplete, setAutoComplete] = useState(false);
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
    const [data, settings, walletData] = await Promise.all([
      getMerchantDashboard(),
      getMerchantPickupSettings(),
      getMerchantFinanceWallet(),
    ]);
    setOrders(data.orders ?? []);
    setAutoComplete(settings.settings.auto_complete_enabled);
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
    const id = window.setInterval(() => void load(), 20_000);
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
    return orders
      .filter((o) => matchesFilter(o, filter))
      .filter((o) => {
        if (!q) return true;
        return (
          o.product_name?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.customer_phone?.includes(q) ||
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
    } catch {
      toast.error("Holatni yangilab bo'lmadi");
    } finally {
      setBusyId(null);
    }
  };

  const confirmPickup = async (order: OrderRow) => {
    setBusyId(order.id);
    try {
      const res = await confirmMerchantPickup(order.id);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === order.id ? { ...o, status: res.status, arrival_status: null, dwell_minutes: null } : o,
        ),
      );
      toast.success("Olib ketildi");
    } catch {
      toast.error("Tasdiqlab bo'lmadi");
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
      toast.error("AWB yuklanmadi");
    }
  };

  const toggleAutoComplete = async () => {
    try {
      const res = await patchMerchantPickupSettings({ auto_complete_enabled: !autoComplete });
      setAutoComplete(res.settings.auto_complete_enabled);
      toast.success(res.settings.auto_complete_enabled ? "Avtomatik yakunlash yoqildi" : "Qo'lda tasdiqlash");
    } catch {
      toast.error("Sozlamani saqlab bo'lmadi");
    }
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-3xl" />;
  }

  return (
    <div className="space-y-4">
      <div className="crm-surface-card overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border-subtle p-4 sm:p-5 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1 lg:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buyurtma qidirish..."
              className="h-11 w-full rounded-full border border-border-subtle bg-canvas pl-10 pr-4 text-sm text-text-100 placeholder:text-text-400 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/15"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-text-400">
            <input
              type="checkbox"
              checked={autoComplete}
              onChange={() => void toggleAutoComplete()}
              className="h-4 w-4 rounded border-border-subtle text-electric-500"
            />
            Avtomatik yakunlash
          </label>
        </div>

        {wallet ? (
          <div className="flex flex-wrap gap-2 border-b border-border-subtle px-4 py-2.5 sm:px-5">
            <span className="rounded-full bg-canvas px-3 py-1 text-xs text-text-400">
              Balans: <strong className="text-text-100">{wallet.current_balance}</strong> so&apos;m
            </span>
            <span className="rounded-full bg-canvas px-3 py-1 text-xs text-text-400">
              Muzlatilgan: <strong className="text-text-100">{wallet.frozen_balance}</strong>
            </span>
          </div>
        ) : null}

        <div className="flex gap-1 overflow-x-auto border-b border-border-subtle px-4 sm:gap-5 sm:px-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilter(tab.key)}
              className={cn(
                "shrink-0 border-b-2 py-3.5 text-sm font-medium transition",
                filter === tab.key
                  ? "border-text-100 text-text-100"
                  : "border-transparent text-text-400 hover:text-text-200",
              )}
            >
              {tab.label}
              <span className="ml-1 tabular-nums text-text-400">({counts[tab.key]})</span>
            </button>
          ))}
        </div>

        {!visible.length ? (
          <div className="py-20 text-center">
            <Package className="mx-auto h-10 w-10 text-text-400/40" />
            <p className="mt-3 font-medium text-text-100">Buyurtma topilmadi</p>
            <p className="mt-1 text-sm text-text-400">Yangi band qilishlar shu yerda chiqadi</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs font-medium text-text-400">
                    <th className="px-4 py-3.5 sm:px-5">Buyurtma</th>
                    <th className="px-4 py-3.5">Mijoz</th>
                    <th className="px-4 py-3.5">Tur</th>
                    <th className="px-4 py-3.5">Summa</th>
                    <th className="px-4 py-3.5">Olib ketish</th>
                    <th className="px-4 py-3.5">Holat</th>
                    <th className="w-12 px-4 py-3.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((order) => {
                    const meta = STATUS_META[order.status] ?? { label: order.status, variant: "default" as const };
                    const isDelivery = order.fulfillment_type === "delivery";
                    const isDone = ["completed", "cancelled"].includes(order.status);
                    const activeStatuses = STATUS_FLOW.filter((s) => !["completed", "cancelled"].includes(s.value));

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
                            <a href={`tel:${order.customer_phone}`} className="font-medium text-electric-600 hover:underline">
                              {order.customer_phone}
                            </a>
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
                            onPickup={() => void confirmPickup(order)}
                            onDispatch={() => void dispatchCourier(order)}
                            onSync={() => void syncDelivery(order)}
                            onWaybill={() => void openWaybill(order)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-border-subtle/80 md:hidden">
              {visible.map((order) => {
                const meta = STATUS_META[order.status] ?? { label: order.status, variant: "default" as const };
                const isDone = ["completed", "cancelled"].includes(order.status);
                return (
                  <li key={order.id} className="space-y-2 px-4 py-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-text-100">{order.product_name}</p>
                        <p className="text-xs text-text-400">{shortId(order.id)} · {formatPrice(order.total_price)}</p>
                      </div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    {!isDone ? (
                      <select
                        value={order.status}
                        disabled={busyId === order.id}
                        onChange={(e) => void changeStatus(order.id, e.target.value)}
                        className="h-10 w-full rounded-xl border border-border-subtle bg-canvas px-3 text-sm"
                      >
                        {STATUS_FLOW.filter((s) => !["completed", "cancelled"].includes(s.value)).map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <div className="flex justify-end">
                      <OrderActionsMenu
                        order={order}
                        busy={busyId === order.id}
                        onPickup={() => void confirmPickup(order)}
                        onDispatch={() => void dispatchCourier(order)}
                        onSync={() => void syncDelivery(order)}
                        onWaybill={() => void openWaybill(order)}
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
            <h4 className="font-semibold text-text-100">AWB yorliq</h4>
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
