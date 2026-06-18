"use client";

import { Building2, CheckCircle2, Layers, MapPin, Phone, Sparkles, Store, X } from "lucide-react";
import Link from "next/link";

import { PickupQrCard } from "@/components/orders/pickup-qr-card";
import type { PickupReservationResponse } from "@/lib/api";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { formatPhoneHotline } from "@/utils/phone-mask";
import { cn } from "@/lib/utils";

type ReservationSuccessModalProps = {
  data: PickupReservationResponse;
  onClose: () => void;
};

function MetaRow({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  iconClass: string;
}) {
  if (!value?.trim()) return null;
  return (
    <div className="flex items-start gap-3">
      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80", iconClass)}>
        <Icon size={15} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="mt-0.5 text-sm font-semibold text-ink-900">{value}</p>
      </div>
    </div>
  );
}

export function ReservationSuccessModal({ data, onClose }: ReservationSuccessModalProps) {
  const addr = data.store_address;
  const hotline = formatPhoneHotline(data.merchant_phone);
  const showOnlinePay = allowOnlineCheckout() && Boolean(data.online_checkout_url);
  const primaryOrderId = data.reservations[0]?.order_id;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-ink-950/75 p-0 backdrop-blur-md sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reservation-success-title"
        className="relative max-h-[92dvh] w-full max-w-md animate-in fade-in slide-in-from-bottom-6 overflow-y-auto duration-300 sm:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-t-[1.75rem] border border-white/25 bg-white/90 shadow-2xl backdrop-blur-xl sm:rounded-[1.75rem]">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-electric-500/20 to-transparent" />

          <div className="relative p-6 pb-5">
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-1.5 text-ink-400 backdrop-blur-sm transition-colors hover:bg-ink-100 hover:text-ink-700"
              aria-label="Yopish"
            >
              <X size={18} />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3 flex h-16 w-16 items-center justify-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-electric-500/20" />
                <span className="relative flex h-14 w-14 items-center justify-center rounded-full border border-electric-500/30 bg-electric-500/10 text-electric-500 shadow-lg">
                  <CheckCircle2 size={30} strokeWidth={2} />
                </span>
              </div>
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-electric-500">
                <Sparkles size={12} />
                Tasdiqlangan bron
              </div>
              <h3 id="reservation-success-title" className="text-xl font-bold tracking-tight text-ink-900">
                Tayyor — kelishingiz mumkin!
              </h3>
              <p className="mt-2 max-w-xs text-xs leading-relaxed text-ink-500">
                <span className="font-semibold text-ink-800">
                  {data.pickup_date} · {data.pickup_window_label}
                </span>
              </p>
              {data.payment_method_label ? (
                <span className="mt-3 inline-flex rounded-full border border-electric-500/25 bg-electric-500/8 px-3 py-1 text-[10px] font-semibold text-electric-600">
                  {data.payment_method_label}
                </span>
              ) : null}
            </div>

            {primaryOrderId ? (
              <div className="mt-5">
                <PickupQrCard
                  orderId={primaryOrderId}
                  fulfillmentType="pickup"
                  status={data.status || "reserved"}
                  variant="boarding"
                />
              </div>
            ) : null}

            <div className="mt-5 space-y-3.5 rounded-2xl border border-white/70 bg-ink-50/70 p-4 backdrop-blur-sm">
              {data.shop_name ? (
                <p className="flex items-center gap-2 border-b border-ink-200/60 pb-3 text-sm font-bold text-ink-900">
                  <Store size={15} className="text-electric-600" />
                  {data.shop_name}
                </p>
              ) : null}
              <MetaRow icon={Building2} label="Blok" value={addr?.block ?? ""} iconClass="text-electric-600" />
              <MetaRow icon={Layers} label="Qavat" value={addr?.floor ?? ""} iconClass="text-violet-500" />
              <MetaRow icon={MapPin} label="Rasta / Do'kon" value={addr?.stall || data.store_location} iconClass="text-amber-600" />
              <div className="flex items-start gap-3 border-t border-ink-200/60 pt-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-electric-500/15 text-electric-500">
                  <Phone size={15} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Issiq liniya</p>
                  <a
                    href={`tel:${data.merchant_phone.replace(/\s/g, "")}`}
                    className="mt-0.5 block font-mono text-base font-bold text-electric-600 hover:underline"
                  >
                    {hotline}
                  </a>
                </div>
              </div>
            </div>

            <div className={cn("mt-5 grid gap-2.5", showOnlinePay ? "grid-cols-1" : "grid-cols-2")}>
              {showOnlinePay && data.online_checkout_url ? (
                <Link
                  href={data.online_checkout_url}
                  className="rounded-xl bg-indigo-600 py-3.5 text-center text-xs font-bold text-white shadow-lg transition-all hover:bg-indigo-500 active:scale-[0.98]"
                >
                  Onlayn to&apos;lovni yakunlash
                </Link>
              ) : null}
              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  href={data.map_url}
                  className="rounded-xl border border-ink-200/80 bg-white/90 py-3.5 text-center text-xs font-bold text-ink-800 backdrop-blur-sm transition-all hover:bg-white active:scale-[0.98]"
                >
                  Xaritada yo&apos;l
                </Link>
                <Link
                  href="/orders"
                  className="rounded-xl bg-electric-500 py-3.5 text-center text-xs font-bold text-white shadow-lg shadow-electric-500/30 transition-all hover:bg-electric-400 active:scale-[0.98]"
                >
                  Buyurtmalarim
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
