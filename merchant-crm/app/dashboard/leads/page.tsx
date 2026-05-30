"use client";

import { CrmLegacyRedirect } from "@/components/crm/crm-legacy-redirect";

export default function LeadsLegacyPage() {
  return <CrmLegacyRedirect target="/dashboard/sales?tab=leads" />;
}
