"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CrmTabShell } from "@/components/crm/crm-tab-shell";
import { LeadsPanel } from "@/components/leads-panel";
import { OrdersPanel } from "@/components/orders-panel";
import { CRM_SALES_TABS } from "@/lib/crm-nav";

function SalesHubContent() {
  const tab = useSearchParams().get("tab") === "leads" ? "leads" : "orders";

  return (
    <CrmTabShell
      tabs={CRM_SALES_TABS}
      activeTab={tab}
      title="Savdo"
      description="Buyurtmalar va leadlar — tez filtrlash, aniq holatlar."
    >
      {tab === "leads" ? <LeadsPanel /> : <OrdersPanel />}
    </CrmTabShell>
  );
}

export default function SalesHubPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
      <SalesHubContent />
    </Suspense>
  );
}
