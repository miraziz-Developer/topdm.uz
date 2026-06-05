"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { CrmTabShell } from "@/components/crm/crm-tab-shell";
import { AnalyticsHubPanel } from "@/components/hubs/analytics-hub-panel";
import { ShareHubPanel } from "@/components/hubs/share-hub-panel";
import { CrmTip } from "@/components/crm/crm-section";
import { IncomingVisitorsPanel } from "@/components/incoming-visitors-panel";
import { PrecisionLocationWorkspace } from "@/components/precision-location-workspace";
import { ShopBrandingPanel } from "@/components/shop-branding-panel";
import { CRM_SHOP_TABS } from "@/lib/crm-nav";
import BillingPage from "@/app/dashboard/billing/page";

function ShopHubContent() {
  const tabParam = useSearchParams().get("tab");
  const tab =
    tabParam === "profile" ||
    tabParam === "map" ||
    tabParam === "analytics" ||
    tabParam === "billing"
      ? tabParam
      : "profile";

  return (
    <CrmTabShell
      tabs={CRM_SHOP_TABS}
      activeTab={tab}
      title="Do'kon"
      description="Logo va brend, ulashish, joylashuv, statistika — hammasi bitta joyda."
    >
      {tab === "profile" ? <ShopBrandingPanel /> : null}
      {tab === "share" ? <ShareHubPanel /> : null}
      {tab === "map" ? (
        <div className="space-y-4">
          <CrmTip>
            <strong className="font-semibold text-text-100">Yandex xarita</strong> — haqiqiy bozor joyi, qavat va qator.{" "}
            <strong className="font-semibold text-text-100">Yo&apos;ldagi mijozlar</strong> — bron qilganlar qanchalik uzoqda.
          </CrmTip>
          <PrecisionLocationWorkspace />
          <IncomingVisitorsPanel />
        </div>
      ) : null}
      {tab === "analytics" ? <AnalyticsHubPanel /> : null}
      {tab === "billing" ? <BillingPage searchParams={{ embedded: "true" }} /> : null}
    </CrmTabShell>
  );
}

export default function ShopHubPage() {
  return (
    <Suspense fallback={<div className="skeleton h-64 rounded-3xl" />}>
      <ShopHubContent />
    </Suspense>
  );
}
