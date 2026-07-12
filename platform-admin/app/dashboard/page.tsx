"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  CreditCard,
  MessageSquare,
  Package,
  ShoppingBag,
  ShoppingCart,
  Store,
  TrendingUp,
  Users,
  Wallet,
  Zap,
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
import { cn, formatDate, formatUzs } from "@/lib/utils";

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

function MiniStatRow({ label, value, icon, tone }: { label: string; value: string | number; icon: React.ReactNode; tone?: string }) {
  const colors: Record<string, string> = {
    green: "text-green-400",
    amber: "text-amber-400",
    red: "text-red-400",
    blue: "text-blue-400",
    purple: "text-purple-400",
    default: "text-muted-foreground",
  };
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
      <dt className={cn("flex items-center gap-2 text-sm", colors[tone ?? "default"])}>
        {icon}
        <span className="text-muted-foreground">{label}</span>
      </dt>
      <dd className="font-semibold text-sm">{value}</dd>
    </div>
  );
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

  const totals = data.totals as Record<string, number>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ---- Row 1: Action items (urgent) ---- */}
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

      {/* ---- Row 2: Today stats ---- */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Bugungi buyurtmalar"
          value={totals.today_orders ?? 0}
          hint="Bugun tushgan"
          icon={<Zap className="h-5 w-5" />}
          tone="blue"
          href="/dashboard/orders"
        />
        <StatCard
          label="Bugungi GMV"
          value={formatUzs(totals.today_gmv ?? 0)}
          hint="Bugungi tushum"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="green"
          href="/dashboard/analytics"
        />
        <StatCard
          label="Tasdiqlangan do'konlar"
          value={totals.verified_shops ?? 0}
          hint={`${totals.shops ?? 0} ta jami`}
          icon={<BadgeCheck className="h-5 w-5" />}
          tone="green"
          href="/dashboard/shops"
        />
        <StatCard
          label="Bloklangan do'konlar"
          value={totals.blocked_shops ?? 0}
          hint="Qarzdorlik sababli"
          icon={<Ban className="h-5 w-5" />}
          tone={totals.blocked_shops > 0 ? "red" : "amber"}
          href="/dashboard/shops"
        />
      </div>

      {/* ---- Row 3: Chart + Platform stats ---- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="admin-card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold">7 kunlik GMV</h2>
            <Link href="/dashboard/analytics" className="text-xs text-primary hover:underline flex items-center gap-1">
              Analitika <ArrowRight className="h-3 w-3" />
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
          <h2 className="mb-3 text-base font-semibold">Platforma ko&apos;rsatkichlari</h2>
          <dl className="space-y-0">
            <MiniStatRow
              label="Do'konlar (faol/jami)"
              value={`${totals.active_shops ?? 0}/${totals.shops ?? 0}`}
              icon={<Store className="h-4 w-4" />}
              tone="blue"
            />
            <MiniStatRow
              label="Mahsulotlar (faol)"
              value={`${totals.available_products ?? 0}/${totals.products ?? 0}`}
              icon={<Package className="h-4 w-4" />}
              tone="blue"
            />
            <MiniStatRow
              label="Foydalanuvchilar"
              value={totals.users ?? 0}
              icon={<Users className="h-4 w-4" />}
              tone="default"
            />
            <MiniStatRow
              label="Buyurtmalar (faol)"
              value={`${totals.orders ?? 0} (${totals.pending_orders ?? 0} faol)`}
              icon={<ShoppingBag className="h-4 w-4" />}
              tone={totals.pending_orders > 0 ? "amber" : "default"}
            />
            <MiniStatRow
              label="Jami foyda"
              value={formatUzs(data.profit.earned_profit_uzs)}
              icon={<TrendingUp className="h-4 w-4" />}
              tone="green"
            />
          </dl>
        </div>
      </div>

      {/* ---- Row 4: Recent orders + Recent shops ---- */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recent orders */}
        <div className="admin-card overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-primary" />
              So&apos;nggi buyurtmalar
            </h2>
            <Link href="/dashboard/orders" className="text-xs text-primary hover:underline flex items-center gap-1">
              Barchasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {data.recent_orders.length === 0 ? (
            <EmptyState title="Buyurtma yo'q" />
          ) : (
            <div className="space-y-2">
              {data.recent_orders.slice(0, 6).map((o) => (
                <div key={o.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    <StatusBadge status={o.status} />
                    <span className="font-mono text-xs text-muted-foreground">{o.id.slice(0, 8)}…</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{formatUzs(o.total_uzs)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(o.created_at ?? "")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent shops */}
        <div className="admin-card overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Store className="h-4 w-4 text-primary" />
              Yangi do&apos;konlar
            </h2>
            <Link href="/dashboard/shops" className="text-xs text-primary hover:underline flex items-center gap-1">
              Barchasi <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {(data.recent_shops ?? []).length === 0 ? (
            <EmptyState title="Do'kon yo'q" />
          ) : (
            <div className="space-y-2">
              {(data.recent_shops ?? []).slice(0, 6).map((s) => (
                <div key={s.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-2">
                    {s.is_verified ? (
                      <BadgeCheck className="h-4 w-4 text-green-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.slug}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded-full font-medium",
                      s.is_verified ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"
                    )}>
                      {s.is_verified ? "Tasdiqlangan" : (s.verification_status ?? "Kutilmoqda")}
                    </span>
                    <div className="text-xs text-muted-foreground mt-0.5">{formatDate(s.created_at ?? "")}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Quick actions ---- */}
      {(data.counts.pending_shops > 0 || data.counts.open_support_tickets > 0) && (
        <div className="admin-card border-amber-500/20 bg-amber-500/5">
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Tezkor harakatlar kerak
          </h2>
          <div className="flex flex-wrap gap-2">
            {data.counts.pending_shops > 0 && (
              <Link
                href="/dashboard/shops"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-400 hover:bg-amber-500/25 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                {data.counts.pending_shops} ta do&apos;kon kutmoqda
              </Link>
            )}
            {data.counts.open_support_tickets > 0 && (
              <Link
                href="/dashboard/support"
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/25 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                {data.counts.open_support_tickets} ta murojaat ochiq
              </Link>
            )}
            {data.counts.pending_payouts > 0 && (
              <Link
                href="/dashboard/payouts"
                className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-400 hover:bg-purple-500/25 transition-colors"
              >
                <CreditCard className="h-3.5 w-3.5" />
                {data.counts.pending_payouts} ta to&apos;lov so&apos;rovi
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
