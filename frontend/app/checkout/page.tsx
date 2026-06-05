"use client";

import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { FastCheckout } from "@/components/checkout/FastCheckout";
import { Navigation } from "@/components/Navigation";
import { ProductSkeleton } from "@/components/ui/product-skeleton";

function CheckoutBody() {
  return <FastCheckout />;
}

export default function CheckoutPage() {
  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-8">
      <Navigation />
      <div className="page-content-top mx-auto max-w-5xl px-4 pb-8 sm:px-5">
        <h1 className="mb-8 text-3xl font-bold tracking-tight text-ink-900">
          Buyurtmani rasmiylashtirish
        </h1>
        <Suspense fallback={<ProductSkeleton />}>
          <CheckoutBody />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  );
}
