"use client";

import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { FastCheckout } from "@/components/checkout/FastCheckout";
import { Navigation } from "@/components/Navigation";
import { ProductSkeleton } from "@/components/ui/product-skeleton";

export default function CheckoutPage() {
  return (
    <main className="page-shell min-h-dvh md:pb-8">
      <Navigation />
      <div className="page-content-top">
        <Suspense fallback={<ProductSkeleton />}>
          <FastCheckout />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  );
}
