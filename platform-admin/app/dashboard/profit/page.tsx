"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Banknote, Clock, CreditCard, Info, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";

import { StatCard } from "@/components/ui/card";
import { getPlatformProfit } from "@/lib/admin-api";
import { formatUzs } from "@/lib/utils";

export default function ProfitPage() {
  const profitQ = useQuery({ queryKey: ["platform-profit"], queryFn: getPlatformProfit });
  const profit = profitQ.data;

  if (profitQ.isLoading) {
    return <p className="text-muted-foreground">Yuklanmoqda...</p>;
  }

  const earned = profit?.earned_profit_uzs ?? 0;
  const held = profit?.held_escrow_uzs ?? 0;
  const withdrawn = profit?.swept_completed_uzs ?? 0;
  const available = profit?.withdrawable_uzs ?? 0;

  return (
    <div className="space-y-6">
      <div className="admin-card flex gap-3 border-primary/30 bg-primary/5 p-4">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="space-y-1 text-sm">
          <p className="font-semibold text-foreground">Click orqali to&apos;g&apos;ridan-to&apos;g&apos;ri hisob-kitob</p>
          <p className="text-muted-foreground">
            Platforma komissiyasi Click merchant hisobingiz orqali avtomatik yig&apos;iladi. Keyingi oydan qo&apos;lda
            &quot;sweep&quot; yaratish shart emas — pul to&apos;g&apos;ridan-to&apos;g&apos;ri Click balansingizda ko&apos;rinadi.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Realizatsiya qilingan komissiya"
          value={formatUzs(earned)}
          icon={<Banknote className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Escrowda (yetkazilish kutilmoqda)"
          value={formatUzs(held)}
          icon={<Clock className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard
          label="Yechilgan (tarixiy)"
          value={formatUzs(withdrawn)}
          icon={<Wallet className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Sof balans"
          value={formatUzs(available)}
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="green"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card space-y-4">
          <h2 className="font-semibold">Hisob-kitob qoidalari</h2>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Faqat <strong className="text-foreground">yetkazilgan</strong> buyurtmalardan komissiya platforma foydasiga
              hisoblanadi.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Escrow&apos;dagi pul do&apos;konchilar puli — platforma uni tegmaydi.
            </li>
            <li className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Do&apos;konchilar to&apos;lovlari alohida —{" "}
              <Link href="/dashboard/payouts" className="inline-flex items-center gap-1 text-primary hover:underline">
                To&apos;lovlar
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>{" "}
              bo&apos;limida.
            </li>
          </ul>
        </div>

        <div className="admin-card space-y-4">
          <h2 className="font-semibold">Moliyaviy xulosa</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">Jami realizatsiya (komissiya)</dt>
              <dd className="font-semibold">{formatUzs(earned)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">+ Escrowda kutilmoqda</dt>
              <dd className="font-semibold text-amber-400">{formatUzs(held)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
              <dt className="text-muted-foreground">− Yechilgan (tarixiy)</dt>
              <dd className="font-semibold text-emerald-400">{formatUzs(withdrawn)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1">
              <dt className="font-medium">Sof balans</dt>
              <dd className="text-lg font-bold text-primary">{formatUzs(available)}</dd>
            </div>
          </dl>
          {profit?.note ? (
            <p className="flex gap-2 rounded-lg bg-secondary/40 p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              {profit.note}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
