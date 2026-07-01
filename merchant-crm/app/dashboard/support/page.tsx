"use client";

import { CrmPageHeader } from "@/components/crm-page-header";
import { MerchantSupportPanel } from "@/components/support/merchant-support-panel";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <CrmPageHeader
        eyebrow="Yordam"
        title="Qo'llab-quvvatlash"
        description="AI yordamchi yoki murojaat — savolingizga tez va aniq javob oling"
      />
      <MerchantSupportPanel />
    </div>
  );
}
