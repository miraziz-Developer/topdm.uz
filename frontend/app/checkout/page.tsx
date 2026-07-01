"use client";

import { Suspense } from "react";

import { BottomNav } from "@/components/BottomNav";
import { FastCheckout } from "@/components/checkout/FastCheckout";
import { Navigation } from "@/components/Navigation";
import { ProductSkeleton } from "@/components/ui/product-skeleton";
import { pageShellCheckout, pageContentTop } from "@/lib/responsive-layout";

export default function CheckoutPage() {
  return (
    <main className={pageShellCheckout}>
      <Navigation />
      <div className={pageContentTop}>
        <Suspense fallback={<ProductSkeleton />}>
          <FastCheckout />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  );
}
