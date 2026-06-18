"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CrmTabShell } from "@/components/crm/crm-tab-shell";
import { ModerationQueue } from "@/components/moderation-queue";
import { ProductsCatalogPanel } from "@/components/products-catalog-panel";
import { ReviewsModerationPanel } from "@/components/reviews-moderation-panel";
import { CRM_PRODUCT_TABS } from "@/lib/crm-nav";

function ProductsHubInner() {
  const tabParam = useSearchParams().get("tab");
  const tab =
    tabParam === "moderation" ? "moderation" : tabParam === "reviews" ? "reviews" : "catalog";

  return (
    <CrmTabShell
      tabs={CRM_PRODUCT_TABS}
      activeTab={tab}
      title="Mahsulotlar"
      description="Katalog, narx va ombor — botdan AI yoki qo'lda."
    >
      {tab === "moderation" ? <ModerationQueue /> : null}
      {tab === "reviews" ? <ReviewsModerationPanel /> : null}
      {tab === "catalog" ? <ProductsCatalogPanel /> : null}
    </CrmTabShell>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
      <ProductsHubInner />
    </Suspense>
  );
}
