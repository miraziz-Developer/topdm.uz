"use client";

import { Banknote, CalendarClock, CreditCard, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PICKUP_SLOTS } from "@/components/checkout/pickup-schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  cancelMyOrder,
  changeOrderPaymentMethod,
  rescheduleMyOrder,
  retryOrderPayment,
} from "@/lib/api";
import { ApiError } from "@/lib/http-client";
import { allowOnlineCheckout } from "@/lib/runtime-flags";
import { SALES } from "@/components/brand/sales-ui";
import { cn } from "@/lib/utils";
import type { Order } from "@/types";

const IN_STORE_PAYMENT_OPTIONS = [
  { id: "cash" as const, icon: Banknote, title: "Naqd pul", subtitle: "Do'konda naqd to'laysiz" },
  { id: "terminal" as const, icon: CreditCard, title: "Terminal", subtitle: "Uzcard / Humo — do'konda" },
];

type Props = {
  order: Order;
  guestPhone?: string;
  guestVerificationToken?: string;
  onUpdated?: () => void;
};

export function OrderManageActions({ order, guestPhone, guestVerificationToken, onUpdated }: Props) {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [paymentSwitchOpen, setPaymentSwitchOpen] = useState(false);
  const [pickupDate, setPickupDate] = useState(order.pickup_date ?? "");
  const [pickupTime, setPickupTime] = useState(order.pickup_time ?? "12:00");

  const guestBody =
    guestPhone && guestVerificationToken
      ? { user_phone: guestPhone, verification_token: guestVerificationToken }
      : {};

  const unpaidClick = order.payment_method === "click" && order.payment_status === "unpaid";
  const payUrl = order.online_checkout_url;

  const handleCancel = async () => {
    if (!window.confirm("Buyurtmani bekor qilasizmi?")) return;
    setBusy("cancel");
    try {
      await cancelMyOrder(order.id, { ...guestBody });
      push("Buyurtma bekor qilindi", "success");
      onUpdated?.();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Bekor qilib bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleReschedule = async () => {
    if (!pickupDate) {
      push("Sanani tanlang", "error");
      return;
    }
    setBusy("reschedule");
    try {
      await rescheduleMyOrder(order.id, {
        pickup_date: pickupDate,
        pickup_time: pickupTime,
        ...guestBody,
      });
      push("Olib ketish vaqti yangilandi — do'kon xabardor qilindi", "success");
      setRescheduleOpen(false);
      onUpdated?.();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Vaqt o'zgartirilmadi", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleRetryPay = async () => {
    setBusy("pay");
    try {
      if (payUrl && allowOnlineCheckout()) {
        router.push(payUrl);
        return;
      }
      const res = await retryOrderPayment(order.id, { ...guestBody });
      if (res.online_checkout_url) {
        router.push(res.online_checkout_url);
      } else {
        push("To'lov havolasi topilmadi", "error");
      }
    } catch (err) {
      push(err instanceof ApiError ? err.message : "To'lovni boshlab bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleChangePaymentMethod = async (method: "cash" | "terminal") => {
    const label = method === "cash" ? "naqd" : "terminal";
    if (!window.confirm(`To'lov turini ${label}ga o'zgartirasizmi? Do'konda to'laysiz.`)) return;
    setBusy(`pay-${method}`);
    try {
      await changeOrderPaymentMethod(order.id, { payment_method: method, ...guestBody });
      push(`To'lov turi ${label}ga o'zgartirildi — do'kon xabardor qilindi`, "success");
      setPaymentSwitchOpen(false);
      onUpdated?.();
    } catch (err) {
      push(err instanceof ApiError ? err.message : "To'lov turini o'zgartirib bo'lmadi", "error");
    } finally {
      setBusy(null);
    }
  };

  if (order.status === "cancelled") return null;

  return (
    <div className={cn("mt-4 space-y-3 p-3.5", SALES.panelInset)}>
      {unpaidClick ? (
        <div className="rounded-xl border border-amber-300 bg-gradient-to-br from-amber-100 to-amber-50 px-3 py-2.5 text-xs text-amber-950 shadow-sm ring-1 ring-amber-200/80">
          <p className="badge-urgency mb-2 inline-flex">Shoshilinch</p>
          <p className="font-semibold">⏳ Onlayn to&apos;lov kutilmoqda</p>
          <p className="mt-1 text-amber-900/80">
            To&apos;lov amalga oshmasa bron avtomatik bekor qilinadi. Do&apos;kon to&apos;lov tasdiqlangach xabardor qilinadi.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {unpaidClick && (payUrl || allowOnlineCheckout()) ? (
          <Button
            size="sm"
            variant="brand"
            disabled={!!busy}
            leftIcon={busy === "pay" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
            onClick={() => void handleRetryPay()}
          >
            To&apos;lovni yakunlash
          </Button>
        ) : null}

        {order.can_change_payment_method ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!!busy}
            leftIcon={<Banknote className="h-3.5 w-3.5" />}
            onClick={() => setPaymentSwitchOpen((v) => !v)}
          >
            Do&apos;konda to&apos;lash
          </Button>
        ) : null}

        {order.can_reschedule ? (
          <Button
            size="sm"
            variant="secondary"
            disabled={!!busy}
            leftIcon={<CalendarClock className="h-3.5 w-3.5" />}
            onClick={() => setRescheduleOpen((v) => !v)}
          >
            Vaqtni o&apos;zgartirish
          </Button>
        ) : null}

        {order.can_cancel ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600 hover:bg-red/10 hover:text-red-700"
            disabled={!!busy}
            leftIcon={busy === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            onClick={() => void handleCancel()}
          >
            Bekor qilish
          </Button>
        ) : null}
      </div>

      {paymentSwitchOpen && order.can_change_payment_method ? (
        <div className="space-y-2 rounded-xl border border-border-default bg-white p-3 shadow-sm">
          <p className="text-xs font-semibold text-ink-700">
            Onlayn to&apos;lov o&apos;rniga do&apos;konda to&apos;lang
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {IN_STORE_PAYMENT_OPTIONS.map((option) => {
              const Icon = option.icon;
              const loading = busy === `pay-${option.id}`;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={!!busy}
                  onClick={() => void handleChangePaymentMethod(option.id)}
                  className={cn(
                    "rounded-xl border border-border-default bg-elevated/35 p-3 text-left transition hover:border-electric-500/50 hover:bg-white",
                    loading && "opacity-70",
                  )}
                >
                  <Icon className="mb-1.5 h-4 w-4 text-electric-600" />
                  <p className="text-sm font-semibold text-ink-900">{option.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink-500">{option.subtitle}</p>
                  {loading ? (
                    <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-electric-600" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {rescheduleOpen ? (
        <div className="space-y-2 rounded-xl border border-border-default bg-white p-3 shadow-sm">
          <Input
            label="Yangi sana"
            type="date"
            value={pickupDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setPickupDate(e.target.value)}
          />
          <label className="block text-xs font-semibold text-ink-600">
            Vaqt oralig&apos;i
            <select
              className="mt-1 w-full rounded-xl border border-border-default bg-elevated/35 px-3 py-2 text-sm"
              value={pickupTime}
              onChange={(e) => setPickupTime(e.target.value)}
            >
              {PICKUP_SLOTS.map((slot) => (
                <option key={slot.value} value={slot.value}>
                  {slot.label}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="brand" isLoading={busy === "reschedule"} onClick={() => void handleReschedule()}>
            Saqlash
          </Button>
        </div>
      ) : null}

      {unpaidClick ? (
        <Link href="/orders" className="text-[11px] font-medium text-electric-600 hover:underline">
          To&apos;lovdan keyin «Buyurtmalarim» da holatni kuzating
        </Link>
      ) : null}
    </div>
  );
}
