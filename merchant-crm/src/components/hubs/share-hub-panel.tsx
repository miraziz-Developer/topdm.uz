"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSection, CrmTip } from "@/components/crm/crm-section";
import { ReferralPanel } from "@/components/growth/referral-panel";
import { SalesReportShareCard } from "@/components/growth/sales-report-share-card";
import { SupplierImportPanel } from "@/components/growth/supplier-import-panel";
import { ShopShareKitPanel } from "@/components/shop-share-kit-panel";
import { Input } from "@/components/ui/input";
import { getOperatingHours, patchOperatingHours } from "@/lib/api";

export function ShareHubPanel() {
  const [hours, setHours] = useState({ open: "09:00", close: "20:00", busy_note: "" });
  const [kitKey, setKitKey] = useState(0);

  useEffect(() => {
    getOperatingHours()
      .then((op) => setHours(op.operating_hours))
      .catch(() => toast.error("Ish vaqti yuklanmadi"));
  }, []);

  const saveHours = async () => {
    try {
      await patchOperatingHours(hours);
      toast.success("Ish vaqti saqlandi");
      setKitKey((k) => k + 1);
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  return (
    <div className="space-y-4">
      <CrmTip>
        <strong className="font-semibold text-text-100">1-qadam:</strong> QR yoki havolani mijozga yuboring.{" "}
        <strong className="font-semibold text-text-100">2-qadam:</strong> ish vaqtini to&apos;g&apos;ri qo&apos;ying — matnda avtomatik chiqadi.
      </CrmTip>

      <ShopShareKitPanel key={kitKey} />

      <SalesReportShareCard />
      <ReferralPanel />
      <SupplierImportPanel />

      <CrmSection title="Ish vaqti" description="Ulashish matnida ko'rinadi" icon={Clock}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Ochiladi" value={hours.open} onChange={(e) => setHours({ ...hours, open: e.target.value })} />
          <Input label="Yopiladi" value={hours.close} onChange={(e) => setHours({ ...hours, close: e.target.value })} />
          <Input
            label="Qo'shimcha (ixtiyoriy)"
            value={hours.busy_note}
            onChange={(e) => setHours({ ...hours, busy_note: e.target.value })}
            placeholder="Masalan: tushlik 13:00–14:00"
          />
        </div>
        <button type="button" className="crm-btn-primary mt-4" onClick={() => void saveHours()}>
          Saqlash
        </button>
      </CrmSection>
    </div>
  );
}
