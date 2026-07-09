"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CreditCard,
  MessageSquare,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { StatusBadge } from "@/components/admin-status-badge";
import { StatCard } from "@/components/ui/card";
import { getAnalyticsOverview, getDashboard } from "@/lib/admin-api";
import { formatDate, formatUzs } from "@/lib/utils";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: getDashboard,
    refetchInterval: 60_000,
  });

  const analyticsQ = useQuery({
    queryKey: ["dashboard-analytics"],
    queryFn: () => getAnalyticsOverview(7),
    staleTime: 60_000,
  });

  if (isLoading) return <PageLoader />;
  if (error || !data) {
    return <p className="text-destructive">Dashboard yuklanmadi</p>;
  }

  const chartData = (analyticsQ.data?.orders_series ?? []).map((r) => ({
    name: shortDate(r.date),
    buyurtma: r.orders,
    gmv: r.revenue_uzs,
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Kutilayotgan do'konlar"
          value={data.counts.pending_shops}
          hint="Moderatsiya kerak"
          icon={<Store className="h-5 w-5" />}
          tone="amber"
          href="/dashboard/shops"
        />
        <StatCard
          label="To'lov so'rovlari"
          value={data.counts.pending_payouts}
          hint="Do'kon payout"
          icon={<CreditCard className="h-5 w-5" />}
          tone="purple"
          href="/dashboard/payouts"
        />
        <StatCard
          label="Ochiq murojaatlar"
          value={data.counts.open_support_tickets}
          hint="Support CRM"
          icon={<MessageSquare className="h-5 w-5" />}
          tone="red"
          href="/dashboard/support"
        />
        <StatCard
          label="Sof balans"
          value={formatUzs(data.profit.withdrawable_uzs)}
          hint="Platforma foydasi"
          icon={<Wallet className="h-5 w-5" />}
          tone="green"
          href="/dashboard/profit"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="admin-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">7 kunlik GMV</h2>
            <Link href="/dashboard/analytics" className="text-xs text-primary hover:underline">
              Analitika →
            </Link>
          </div>
          <div className="h-56">
            {chartData.length === 0 ? (
              <EmptyState title="Hali buyurtma yo'q" description="GMV grafigi buyurtmalar paydo bo'lganda ko'rinadi" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 18%)" />
                  <XAxis dataKey="name" stroke="hsl(217 10% 64%)" fontSize={11} />
                  <YAxis stroke="hsl(217 10% 64%)" fontSize={11} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    contentStyle={{ background: "hsl(224 47% 8%)", border: "1px solid hsl(215 28% 18%)" }}
                    formatter={(v: number, name: string) => [
                      name === "gmv" ? formatUzs(v) : v,
                      name === "gmv" ? "GMV" : "Buyurtma",
                    ]}
                  />
                  <Bar dataKey="gmv" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="admin-card">
          <h2 className="mb-4 text-base font-semibold">Platforma ko&apos;rsatkichlari</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Store className="h-4 w-4" /> Do&apos;konlar
              </dt>
              <dd className="font-semibold">
                {data.totals.active_shops}/{data.totals.shops}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Package className="h-4 w-4" /> Mahsulotlar
              </dt>
              <dd className="font-semibold">{data.totals.products}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" /> Foydalanuvchilar
              </dt>
              <dd className="font-semibold">{data.totals.users}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <ShoppingBag className="h-4 w-4" /> Buyurtmalar
              </dt>
              <dd className="font-semibold">
                {data.totals.orders}
                {data.totals.pending_orders > 0 ? (
                  <span className="ml-1 text-xs text-amber-400">({data.totals.pending_orders} faol)</span>
                ) : null}
              </dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <TrendingUp className="h-4 w-4" /> Jami foyda
              </dt>
              <dd className="font-semibold">{formatUzs(data.profit.earned_profit_uzs)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="admin-card overflow-hidden">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">So&apos;nggi buyurtmalar</h2>
          <Link href="/dashboard/orders" className="text-xs text-primary hover:underline">
            Barchasi →
          </Link>
        </div>
        {data.recent_orders.length === 0 ? (
          <EmptyState title="Buyurtma yo'q" />
        ) : (
          <div className="admin-scroll-x">
            <table className="admin-table min-w-[520px]">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Holat</th>
                  <th>Summa</th>
                  <th>Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {data.recent_orders.map((o) => (
                  <tr key={o.id}>
                    <td className="font-mono text-xs">{o.id.slice(0, 8)}…</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{formatUzs(o.total_uzs)}</td>
                    <td className="text-muted-foreground">{formatDate(o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
