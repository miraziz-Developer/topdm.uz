"use client";

import { QrCode, RefreshCw, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getGuestOrderPickupQr, getOrderPickupQr } from "@/lib/api";
import { ScanBeam } from "@/components/ui/scan-beam";
import { LivePill } from "@/components/ui/live-pill";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";

type PickupQrPayload = {
  order_id: string;
  qr_image_url: string;
  product_name: string;
  quantity: number;
  total_price: number;
  hint: string;
  status: string;
};

type Props = {
  orderId: string;
  fulfillmentType?: string;
  status: string;
  guestPhone?: string;
  guestVerificationToken?: string;
  className?: string;
  variant?: "default" | "boarding";
};

const ACTIVE = new Set(["pending", "reserved", "confirmed", "preparing", "ready"]);

export function PickupQrCard({
  orderId,
  fulfillmentType,
  status,
  guestPhone,
  guestVerificationToken,
  className,
  variant = "default",
}: Props) {
  const [data, setData] = useState<PickupQrPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPickup = (fulfillmentType || "pickup") !== "delivery";
  const canShow = isPickup && ACTIVE.has(status);
  const isBoarding = variant === "boarding";

  const load = useCallback(async () => {
    if (!canShow) return;
    setLoading(true);
    setError(null);
    try {
      const res =
        guestPhone && guestVerificationToken
          ? await getGuestOrderPickupQr(orderId, guestPhone, guestVerificationToken)
          : await getOrderPickupQr(orderId);
      setData(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "QR yuklanmadi";
      setError(msg);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [canShow, orderId, guestPhone, guestVerificationToken]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!canShow) return null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[1.35rem] border border-electric-500/25 bg-gradient-to-br from-electric-500/[0.08] via-white to-amber-50/40 p-4 shadow-[0_20px_50px_-24px_rgba(0,102,255,0.45)]",
        isBoarding && "border-electric-500/35 p-5 ring-1 ring-white/60",
        className,
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-electric-500/10 blur-2xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-electric-500/15 text-electric-600">
            <QrCode className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-electric-700">
              {isBoarding ? "Bozorliii Pass" : "Olib ketish QR"}
            </p>
            <p className="text-[10px] text-ink-500">Do&apos;konda skaner qiling</p>
          </div>
        </div>
        <LivePill className="bg-electric-500/10 text-electric-600 [&_span:last-child]:bg-electric-500" />
      </div>

      <p className="relative mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-500">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-electric-500" aria-hidden />
        Imzolangan token — faqat sizning buyurtmangiz uchun. Sotuvchi skaner qilgach avtomatik yopiladi.
      </p>

      {loading ? <div className="skeleton relative mt-4 h-52 w-full max-w-[13rem] rounded-2xl" /> : null}
      {error ? <p className="relative mt-3 text-xs text-red">{error}</p> : null}

      {data ? (
        <div className="relative mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="relative">
            <ScanBeam active variant="electric" className="rounded-2xl" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.qr_image_url}
              alt="Olib ketish QR"
              className="relative z-[1] h-44 w-44 rounded-2xl bg-white p-3 shadow-lg ring-2 ring-electric-500/20 scan-pulse"
            />
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <p className="text-sm font-bold text-ink-900">{data.product_name}</p>
            <p className="mt-1 price-mono text-xs text-ink-500">
              {data.quantity} dona · #{data.order_id.slice(0, 8).toUpperCase()}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-400">{data.hint}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-electric-600 transition hover:text-electric-500"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              QR ni yangilash
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
