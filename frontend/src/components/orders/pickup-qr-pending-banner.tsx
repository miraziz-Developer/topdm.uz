"use client";

import { Clock, QrCode } from "lucide-react";

import { orderStatusLabel } from "@/lib/order-status";
import { cn } from "@/lib/utils";

type Props = {
  status: string;
  className?: string;
};

/** QR hali ochilmagan — do'kon tayyor qilguncha. */
export function PickupQrPendingBanner({ status, className }: Props) {
  return (
    <div
      className={cn(
        "mt-4 flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3.5 shadow-sm",
        className,
      )}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-amber-700 shadow-sm ring-1 ring-amber-200">
        <QrCode className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-800">
          <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
          QR kod hali yopiq
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-500">
          Do&apos;kon buyurtmani <strong className="font-semibold text-ink-700">«Tayyor»</strong> qilgach QR
          ochiladi. Hozirgi holat:{" "}
          <span className="font-semibold text-electric-600">{orderStatusLabel(status)}</span>
        </p>
      </div>
    </div>
  );
}
