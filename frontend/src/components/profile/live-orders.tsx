"use client";

import { motion } from "framer-motion";
import { MapPin, Package } from "lucide-react";
import Link from "next/link";

import { PickupQrCard } from "@/components/orders/pickup-qr-card";
import { Button } from "@/components/ui/button";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_PIPELINE,
  orderProgress,
  orderStatusLabel,
} from "@/lib/order-status";
import { orderShopMapHref } from "@/lib/map-stores";
import { formatShopLocationBadge } from "@/lib/shop-location";
import { cn, formatPrice } from "@/lib/utils";
import type { Order } from "@/types";

type LiveOrdersProps = {
  orders: Order[];
  loading: boolean;
  variant?: "buyer" | "merchant";
  hasPhone?: boolean;
  onAddPhone?: () => void;
};

export function LiveOrders({
  orders,
  loading,
  variant = "buyer",
  hasPhone = true,
  onAddPhone,
}: LiveOrdersProps) {
  if (loading) {
    return (
      <>
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-32 rounded-2xl" />
      </>
    );
  }

  if (orders.length === 0) {
    if (!hasPhone) {
      return (
        <div className="rounded-2xl border border-dashed border-amber-500/25 bg-amber-500/[0.05] px-6 py-10 text-center">
          <Package className="mx-auto h-10 w-10 text-amber-600/60" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink-700">Telefon raqam bog&apos;lanmagan</p>
          <p className="mt-1 text-xs text-ink-500">
            Buyurtmalaringiz checkout telefoni bilan profil telefoni bir xil bo&apos;lishi kerak.
          </p>
          {onAddPhone ? (
            <Button size="sm" variant="brand" className="mt-5" onClick={onAddPhone}>
              Telefon qo&apos;shish
            </Button>
          ) : null}
        </div>
      );
    }

    if (variant === "merchant") {
      return (
        <div className="rounded-2xl border border-dashed border-electric-500/20 bg-electric-500/[0.04] px-6 py-10 text-center">
          <Package className="mx-auto h-10 w-10 text-electric-500/50" aria-hidden />
          <p className="mt-3 text-sm font-medium text-ink-700">Siz xaridor sifatida buyurtma qilmagansiz</p>
          <p className="mt-1 text-xs text-ink-500">
            Do&apos;koningizga kelgan buyurtmalarni CRM → Savdo bo&apos;limida ko&apos;rasiz.
          </p>
          <Link href="/orders" className="mt-5 inline-block">
            <Button size="sm" variant="secondary">
              Barcha xaridlar
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="rounded-2xl border border-dashed border-electric-500/20 bg-electric-500/[0.04] px-6 py-12 text-center">
        <Package className="mx-auto h-10 w-10 text-electric-500/50" aria-hidden />
        <p className="mt-3 text-sm font-medium text-ink-700">Faol buyurtma yo&apos;q</p>
        <p className="mt-1 text-xs text-ink-500">Yakunlangan buyurtmalar «Barchasi» bo&apos;limida.</p>
        <Link href="/search" className="mt-5 inline-block">
          <Button size="sm" variant="brand">
            Katalogga o&apos;tish
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      {orders.map((order, i) => (
        <OrderFlowCard key={order.id} order={order} index={i} />
      ))}
    </>
  );
}

export function OrderFlowCard({
  order,
  index,
  guestPhone,
  guestVerificationToken,
}: {
  order: Order;
  index: number;
  guestPhone?: string;
  guestVerificationToken?: string;
}) {
  const trackerSteps = order.tracker_steps;
  const hasBackendTracker = Boolean(trackerSteps?.length);
  const { pct, activeIndex } = hasBackendTracker
    ? {
        pct: order.tracker_progress_pct ?? 0,
        activeIndex: order.tracker_active_index ?? 0,
      }
    : orderProgress(order.status);
  const statusLabel = order.status_label ?? orderStatusLabel(order.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index }}
      className="rounded-2xl border border-electric-500/12 bg-white p-4 shadow-sm md:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-electric-500/10 pb-4">
        <div className="min-w-0">
          <p className="price-mono text-[11px] font-medium text-ink-400">#{order.id.slice(0, 8).toUpperCase()}</p>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink-900">{order.product.name}</p>
          <p className="mt-1 truncate text-xs text-ink-500">{order.shop.name}</p>
          {order.status !== "cancelled" && order.shop?.id ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="line-clamp-2 text-[11px] text-ink-500">
                {formatShopLocationBadge({
                  name: order.shop.name,
                  floor: order.shop.floor ?? order.shop.block_sector ?? "",
                  ipadrom: order.shop.ipadrom ?? "Ippodrom",
                })}
              </p>
              <Link
                href={orderShopMapHref(order.shop)}
                className="inline-flex shrink-0 items-center gap-1 rounded-full border border-electric-500/25 bg-electric-500/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-electric-600 transition hover:bg-electric-500/15"
              >
                <MapPin className="h-3 w-3" aria-hidden />
                Xaritada ko&apos;rish
              </Link>
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <p className="price-mono text-sm font-bold text-ink-900">{formatPrice(order.total_price)}</p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              order.status === "cancelled" ? "bg-red/10 text-red" : "bg-electric-500/10 text-electric-600",
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {order.status === "cancelled" ? (
        <p className="mt-4 text-xs text-ink-500">Ushbu buyurtma bekor qilingan.</p>
      ) : (
        <>
          <div className="mt-4 flex justify-between gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-ink-400 sm:text-[10px]">
            {(hasBackendTracker
              ? trackerSteps!.map((step) => ({ key: step.status, label: step.label }))
              : ORDER_STATUS_PIPELINE.map((step) => ({
                  key: step,
                  label: ORDER_STATUS_LABELS[step],
                }))
            ).map((step, idx) => (
              <span
                key={step.key}
                className={cn(
                  "min-w-0 flex-1 truncate text-center",
                  idx === activeIndex ? "font-bold text-electric-600" : idx < activeIndex ? "text-ink-600" : "",
                )}
              >
                {step.label}
              </span>
            ))}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-electric-500/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-electric-500 to-electric-400"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 * index }}
            />
          </div>
          <PickupQrCard
            orderId={order.id}
            fulfillmentType={order.fulfillment_type}
            status={order.status}
            guestPhone={guestPhone}
            guestVerificationToken={guestVerificationToken}
          />
        </>
      )}
    </motion.div>
  );
}
