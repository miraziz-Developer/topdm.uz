"use client";

import { CheckCircle2, Package, Phone, User, X } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { resolveMediaUrl } from "@/lib/media";
import { cn, formatPrice } from "@/lib/utils";

export type PickupScanResult = {
  order_id: string;
  status: string;
  already_completed: boolean;
  headline: string;
  customer_name?: string | null;
  customer_label: string;
  customer_phone: string;
  quantity: number;
  total_price: number;
  unit_price?: number;
  payment_method?: string | null;
  payment_label?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  completed_at?: string | null;
  product: { id: string; name: string; price: number; image_url?: string | null };
  items?: Array<{
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    line_total: number;
    image_url?: string | null;
  }>;
  shop: { id: string; name: string };
};

function initials(label: string) {
  const parts = label.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return "M";
}

type Props = {
  result: PickupScanResult;
  onDismiss: () => void;
  onScanAgain: () => void;
};

export function PickupScanSuccessOverlay({ result, onDismiss, onScanAgain }: Props) {
  const success = !result.already_completed;
  const items = result.items?.length
    ? result.items
    : [
        {
          product_id: result.product.id,
          name: result.product.name,
          quantity: result.quantity,
          unit_price: result.unit_price ?? result.product.price,
          line_total: result.total_price,
          image_url: result.product.image_url,
        },
      ];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-4 sm:items-center">
      <div
        className={cn(
          "w-full max-w-md overflow-hidden rounded-3xl bg-surface shadow-2xl ring-1",
          success ? "ring-emerald-500/30" : "ring-amber-500/30",
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pickup-scan-title"
      >
        <div
          className={cn(
            "relative px-5 pb-4 pt-5 text-center",
            success
              ? "bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
              : "bg-gradient-to-br from-amber-500 to-amber-600 text-white",
          )}
        >
          <button
            type="button"
            onClick={onDismiss}
            className="absolute right-3 top-3 rounded-full bg-white/15 p-1.5 text-white transition hover:bg-white/25"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <h2 id="pickup-scan-title" className="mt-3 text-lg font-bold leading-snug">
            {success ? "Mahsulot berildi" : "Allaqachon olib ketilgan"}
          </h2>
          <p className="mt-1 text-sm text-white/90">{result.headline}</p>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 rounded-2xl bg-canvas/80 p-3 ring-1 ring-border-subtle">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-electric-500/15 text-base font-bold text-electric-600">
              {initials(result.customer_label)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">Mijoz</p>
              <p className="truncate text-base font-bold text-text-100">{result.customer_label}</p>
              {result.customer_phone ? (
                <a
                  href={`tel:${result.customer_phone}`}
                  className="mt-0.5 inline-flex items-center gap-1 text-sm font-semibold text-electric-600"
                >
                  <Phone className="h-3.5 w-3.5" />
                  {_formatPhone(result.customer_phone)}
                </a>
              ) : null}
            </div>
            <User className="h-5 w-5 shrink-0 text-text-400/60" />
          </div>

          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-text-400">
              Olib ketilgan mahsulot{items.length > 1 ? "lar" : ""}
            </p>
            <div className="space-y-2">
              {items.map((item) => {
                const img = resolveMediaUrl(item.image_url);
                return (
                  <div
                    key={`${item.product_id}-${item.name}`}
                    className="flex gap-3 rounded-2xl border border-border-subtle bg-canvas/50 p-3"
                  >
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-canvas ring-1 ring-border-subtle">
                      {img ? (
                        <Image src={img} alt={item.name} fill className="object-cover" sizes="80px" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-400">
                          <Package className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-bold leading-snug text-text-100">{item.name}</p>
                      <p className="mt-1 text-xs text-text-400">
                        {item.quantity} dona × {formatPrice(item.unit_price)}
                      </p>
                      <p className="mt-1 text-base font-bold tabular-nums text-text-100">
                        {formatPrice(item.line_total)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-canvas/60 px-3 py-2 ring-1 ring-border-subtle">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-text-400">Buyurtma</dt>
              <dd className="font-mono font-semibold text-text-100">
                #{result.order_id.slice(0, 8).toUpperCase()}
              </dd>
            </div>
            <div className="rounded-xl bg-canvas/60 px-3 py-2 ring-1 ring-border-subtle">
              <dt className="text-[10px] font-bold uppercase tracking-wider text-text-400">Jami</dt>
              <dd className="font-bold tabular-nums text-text-100">{formatPrice(result.total_price)}</dd>
            </div>
            {result.payment_label ? (
              <div className="rounded-xl bg-canvas/60 px-3 py-2 ring-1 ring-border-subtle">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-text-400">To&apos;lov</dt>
                <dd className="font-semibold text-text-100">{result.payment_label}</dd>
              </div>
            ) : null}
            {result.pickup_date ? (
              <div className="rounded-xl bg-canvas/60 px-3 py-2 ring-1 ring-border-subtle">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-text-400">Vaqt</dt>
                <dd className="text-text-100">
                  {result.pickup_date}
                  {result.pickup_time ? ` · ${result.pickup_time}` : ""}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="button" className="flex-1" onClick={onScanAgain}>
              Yana skanerlash
            </Button>
            <Button type="button" variant="secondary" className="flex-1" onClick={onDismiss}>
              Yopish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function _formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("998")) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)} ${digits.slice(8, 10)} ${digits.slice(10, 12)}`;
  }
  return phone;
}
