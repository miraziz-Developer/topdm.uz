"use client";

import { Gift, Link2, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSection } from "@/components/crm/crm-section";
import { getReferralPanel } from "@/lib/api";
import { formatSom } from "@/lib/money";

export function ReferralPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getReferralPanel>> | null>(null);

  useEffect(() => {
    getReferralPanel()
      .then(setData)
      .catch(() => toast.error("Referral yuklanmadi"));
  }, []);

  const copyLink = async () => {
    if (!data?.referral_link) return;
    try {
      await navigator.clipboard.writeText(data.referral_link);
      toast.success("Havola nusxalandi");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  return (
    <CrmSection
      title="Do'stingni taklif qil"
      description="Qo'shni do'kon ro'yxatdan o'tib birinchi buyurtma qabul qilsa — ikkalangizga coin"
      icon={Gift}
    >
      {data ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-gradient-to-r from-amber-500/10 to-electric-500/10 p-4 ring-1 ring-border-subtle">
            <p className="text-sm text-text-300">
              Har ikkala do&apos;kon uchun{" "}
              <strong className="text-electric-600">{formatSom(data.reward_coins_each)} coin</strong> — banner va
              boost uchun.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-canvas px-3 py-2 ring-1 ring-border-subtle">
            <Link2 className="h-4 w-4 shrink-0 text-electric-500" />
            <code className="flex-1 truncate text-xs text-text-200">{data.referral_link}</code>
            <button type="button" className="crm-btn-secondary shrink-0 text-xs" onClick={() => void copyLink()}>
              Nusxa
            </button>
          </div>
          <p className="text-xs text-text-400">
            Kod: <strong className="text-text-200">{data.referral_code}</strong>
          </p>
          <div className="flex gap-4 text-sm text-text-300">
            <span className="inline-flex items-center gap-1">
              <Users className="h-4 w-4" />
              Taklif: {data.referred_shops}
            </span>
            <span>Mukofot: {data.rewarded_shops}</span>
          </div>
        </div>
      ) : (
        <div className="h-24 animate-pulse rounded-xl bg-canvas" />
      )}
    </CrmSection>
  );
}
