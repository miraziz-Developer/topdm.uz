"use client";

import { useSearchParams } from "next/navigation";

import Link from "next/link";

import { parseCheckoutPaymentParams } from "@/components/checkout/checkout-payment-params";
import { OnlinePaymentBridge } from "@/components/checkout/online-payment-bridge";
import { Navigation } from "@/components/Navigation";
import { allowOnlineCheckout } from "@/lib/runtime-flags";

export default function CheckoutClickPage() {
  if (!allowOnlineCheckout()) {
    return (
      <main className="min-h-screen bg-canvas px-4 pt-24">
        <Navigation />
        <p className="mx-auto max-w-md text-center text-sm text-ink-600">
          Onlayn to&apos;lov hozircha yoqilmagan. Checkoutda naqd yoki terminal tanlang.
        </p>
        <p className="mt-4 text-center">
          <Link href="/checkout" className="text-sm font-semibold text-electric-500 hover:underline">
            Checkoutga qaytish
          </Link>
        </p>
      </main>
    );
  }
  const params = useSearchParams();
  const parsed = parseCheckoutPaymentParams(params);

  if (!parsed) {
    return (
      <main className="min-h-screen bg-canvas px-4 pt-24">
        <Navigation />
        <p className="mx-auto max-w-md text-center text-sm text-ink-600">
          Noto&apos;g&aposri to&apos;lov havolasi. Buyurtmalar bo&apos;limidan qayta urinib ko&apos;ring.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas px-4 pb-12 pt-24">
      <Navigation />
      <OnlinePaymentBridge
        provider="click"
        checkoutId={parsed.checkoutId || undefined}
        orderId={parsed.orderId || undefined}
        labelId={parsed.labelId}
        amount={parsed.amount}
      />
    </main>
  );
}
