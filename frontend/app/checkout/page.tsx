"use client";

import { BottomNav } from "@/components/BottomNav";
import { FastCheckout } from "@/components/checkout/FastCheckout";
import { Navigation } from "@/components/Navigation";

export default function CheckoutPage() {
  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-8">
      <Navigation />
      <div className="page-content-top mx-auto max-w-5xl px-4 pb-8 sm:px-5">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-ink-900">
          Tezkor zaxira qilish <span className="text-electric-500">(Olib ketish)</span>
        </h1>
        <FastCheckout />
      </div>
      <BottomNav />
    </main>
  );
}
