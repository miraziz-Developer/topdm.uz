"use client";

import { motion } from "framer-motion";
import { ChevronRight, MapPin, Package } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PickupQrCard } from "@/components/orders/pickup-qr-card";
import { PickupQrPendingBanner } from "@/components/orders/pickup-qr-pending-banner";
import { OrderManageActions } from "@/components/orders/order-manage-actions";
import { SALES } from "@/components/brand/sales-ui";
import { Button } from "@/components/ui/button";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_PIPELINE,
  orderProgress,
  orderStatusLabel,
} from "@/lib/order-status";
import { orderShopMapHref } from "@/lib/map-stores";
import { productImage } from "@/lib/media";
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
  onUpdated,
  linkToDetail = true,
  heroImage = false,
}: {
  order: Order;
  index: number;
  guestPhone?: string;
  guestVerificationToken?: string;
  onUpdated?: () => void;
  linkToDetail?: boolean;
  heroImage?: boolean;
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
  const unpaidClick = order.payment_method === "click" && order.payment_status === "unpaid";
  const isPickup = (order.fulfillment_type || "pickup") !== "delivery";
  const showQr = !unpaidClick && isPickup && order.status === "ready";
  const showQrPending =
    !unpaidClick &&
    isPickup &&
    order.status !== "cancelled" &&
    order.status !== "completed" &&
    order.status !== "ready";

  const accentBorder =
    order.status === "cancelled"
      ? "border-l-red"
      : unpaidClick
        ? "border-l-amber-500"
        : order.status === "ready"
          ? "border-l-green"
          : "border-l-electric-500";

  const thumbSrc = productImage(order.product?.images);
  const detailHref = `/orders/${order.id}`;
  const guestQuery =
    guestPhone && guestVerificationToken
      ? `?phone=${encodeURIComponent(guestPhone)}&token=${encodeURIComponent(guestVerificationToken)}`
      : "";

  const headerInner = (
    <>
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-xl bg-canvas ring-1 ring-border-default",
          heroImage ? "h-28 w-28" : "h-16 w-16",
        )}
      >
        <Image
          src={thumbSrc}
          alt={order.product.name}
          fill
          className="object-cover"
          sizes={heroImage ? "112px" : "64px"}
          unoptimized
        />
      </div>
      <div className="min-w-0 flex-1">
        <p className="price-mono text-[11px] font-medium text-ink-400">#{order.id.slice(0, 8).toUpperCase()}</p>
        <p className={cn("mt-1 line-clamp-2 font-semibold text-ink-900", heroImage ? "text-base" : "text-sm")}>
          {order.product.name}
        </p>
        <p className="mt-1 truncate text-xs text-ink-500">{order.shop.name}</p>
        {order.status !== "cancelled" && order.shop?.id && !heroImage ? (
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
              onClick={(e) => e.stopPropagation()}
              className="inline-flex shrink-0 items-center gap-1 rounded-full border border-electric-500/25 bg-electric-500/8 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-electric-600 transition hover:bg-electric-500/15"
            >
              <MapPin className="h-3 w-3" aria-hidden />
              Xaritada ko&apos;rish
            </Link>
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.06 * index }}
      className={cn(SALES.panel, "border-l-[5px] p-4 md:p-5", accentBorder)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-default pb-4">
        {linkToDetail ? (
          <Link
            href={`${detailHref}${guestQuery}`}
            className="flex min-w-0 flex-1 items-start gap-3 rounded-xl transition hover:bg-canvas/60 -m-2 p-2"
          >
            {headerInner}
            <ChevronRight className="mt-5 h-5 w-5 shrink-0 text-ink-300" aria-hidden />
          </Link>
        ) : (
          <div className="flex min-w-0 flex-1 items-start gap-3">{headerInner}</div>
        )}
        <div className="text-right">
          <p className="price-deal text-sm font-bold text-ink-900">{formatPrice(order.total_price)}</p>
          <span
            className={cn(
              "mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
              order.status === "cancelled"
                ? "bg-red/10 text-red"
                : unpaidClick
                  ? "badge-urgency"
                  : order.status === "ready"
                    ? "badge-trust"
                    : "badge-trust",
            )}
          >
            {unpaidClick ? "To'lov kutilmoqda" : statusLabel}
          </span>
        </div>
      </div>

      {heroImage && order.status !== "cancelled" && order.shop?.id ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="line-clamp-2 text-xs text-ink-500">
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

      {order.status === "cancelled" ? (
        <p className="mt-4 text-xs text-ink-500">Ushbu buyurtma bekor qilingan.</p>
      ) : (
        <>
          <div className={cn("mt-4 px-3 py-3", SALES.panelInset)}>
            <div className="flex justify-between gap-0.5 text-[9px] font-semibold uppercase tracking-wide text-text-400 sm:text-[10px]">
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
                    idx === activeIndex
                      ? "font-bold text-electric-600"
                      : idx < activeIndex
                        ? "font-semibold text-green"
                        : "",
                  )}
                >
                  {step.label}
                </span>
              ))}
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-border-default">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-electric-500 to-electric-400 shadow-[0_0_8px_rgba(0,102,255,0.35)]"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.08 * index }}
              />
            </div>
          </div>
          {showQrPending ? <PickupQrPendingBanner status={order.status} /> : null}
          {showQr ? (
          <PickupQrCard
            orderId={order.id}
            fulfillmentType={order.fulfillment_type}
            status={order.status}
            guestPhone={guestPhone}
            guestVerificationToken={guestVerificationToken}
          />
          ) : null}
          <OrderManageActions
            order={order}
            guestPhone={guestPhone}
            guestVerificationToken={guestVerificationToken}
            onUpdated={onUpdated}
          />
        </>
      )}
    </motion.div>
  );
}
