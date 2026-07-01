"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { AdvertisingBillingPanel } from "@/components/billing/advertising-billing-panel";
import { MerchantFinancePanel } from "@/components/billing/merchant-finance-panel";
import { CrmTabShell } from "@/components/crm/crm-tab-shell";
import { CRM_BILLING_TABS } from "@/lib/crm-nav";

function BillingHubInner() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab = tabParam === "finance" ? "finance" : "ads";
  const topUp = searchParams.get("topup") === "1";

  const title = tab === "finance" ? "Moliya va daromad" : "Reklama balansi";
  const description =
    tab === "finance"
      ? "Savdo puli, kartaga yechish va platforma qarzi — reklamadan alohida."
      : "Boost va bosh sahifa banneri — Click orqali to'ldirasiz.";

  return (
    <CrmTabShell tabs={CRM_BILLING_TABS} activeTab={tab} title={title} description={description}>
      {tab === "ads" ? <AdvertisingBillingPanel autoOpenTopUp={topUp} /> : null}
      {tab === "finance" ? <MerchantFinancePanel /> : null}
    </CrmTabShell>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
      <BillingHubInner />
    </Suspense>
  );
}
