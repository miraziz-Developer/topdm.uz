"use client";

import { CrmLegacyRedirect } from "@/components/crm/crm-legacy-redirect";

export default function OrdersLegacyPage() {
  return <CrmLegacyRedirect target="/dashboard/sales?tab=orders" />;
}
