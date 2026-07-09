"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Footprints,
  Search,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { StatCard } from "@/components/ui/card";
import { getAnalyticsOverview } from "@/lib/admin-api";
import { formatUzs } from "@/lib/utils";

const MARKETS = [
  { value: "ippodrom", label: "Ippodrom" },
  { value: "abu-sahiy", label: "Abu Sahiy" },
  { value: "chorsu", label: "Chorsu" },
  { value: "yangiobod", label: "Yangiobod" },
];

const STATUS_COLORS: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  delivered: "#22c55e",
  cancelled: "#ef4444",
  completed: "#10b981",
};

const BLOCK_COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444"];

function shortDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("uz-UZ", { day: "2-digit", month: "short" });
}

export default function AnalyticsPage() {
  const [slug, setSlug] = useState("ippodrom");
  const [days, setDays] = useState(7);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["analytics-overview", slug, days],
    queryFn: () => getAnalyticsOverview(days, slug),
    staleTime: 60_000,
  });

  const chartData = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, { date: string; orders: number; revenue: number; users: number }>();
    for (const row of data.orders_series) {
      byDate.set(row.date, {
        date: row.date,
        orders: row.orders,
        revenue: row.revenue_uzs,
        users: 0,
      });
    }
    for (const row of data.users_series) {
      const cur = byDate.get(row.date) ?? { date: row.date, orders: 0, revenue: 0, users: 0 };
      cur.users = row.users;
      byDate.set(row.date, cur);
    }
    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  const marketLabel = MARKETS.find((m) => m.value === slug)?.label ?? slug;

  if (isLoading && !data) {
    return <p className="text-muted-foreground">Analitika yuklanmoqda...</p>;
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="admin-card flex flex-wrap items-end gap-3">
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Bozor
          </label>
          <select
            className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
          >
            {MARKETS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Davr
          </label>
          <select
            className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {[7, 14, 30, 90].map((d) => (
              <option key={d} value={d}>
                {d} kun
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {isFetching ? "Yangilanmoqda..." : "Yangilash"}
        </button>
      </div>

      {s ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Savdo (GMV)"
            value={formatUzs(s.revenue_uzs)}
            hint={`${s.orders} ta buyurtma · ${days} kun`}
            icon={<ShoppingBag className="h-5 w-5" />}
            tone="blue"
          />
          <StatCard
            label="O'rtacha chek"
            value={formatUzs(s.avg_order_uzs)}
            hint="Buyurtma boshiga"
            icon={<TrendingUp className="h-5 w-5" />}
            tone="green"
          />
          <StatCard
            label="Yangi foydalanuvchilar"
            value={s.new_users}
            hint={`${days} kun ichida`}
            icon={<Users className="h-5 w-5" />}
            tone="purple"
          />
          <StatCard
            label="Platforma foydasi"
            value={formatUzs(s.platform_profit_uzs)}
            hint="Jami komissiya"
            icon={<Wallet className="h-5 w-5" />}
            tone="amber"
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard
          label="Qidiruvlar"
          value={s?.total_searches ?? 0}
          hint={`${marketLabel} bozori`}
          icon={<Search className="h-5 w-5" />}
          tone="blue"
        />
        <StatCard
          label="Marshrutlar"
          value={s?.total_routes ?? 0}
          hint="Xarita navigatsiyasi"
          icon={<Footprints className="h-5 w-5" />}
          tone="green"
        />
        <StatCard
          label="Faol bloklar"
          value={data?.market.block_footfall.length ?? 0}
          hint="Oyoq trafik zonasi"
          icon={<BarChart3 className="h-5 w-5" />}
          tone="purple"
        />
      </div>

      <div className="admin-card">
        <h2 className="mb-1 text-base font-semibold">Savdo dinamikasi</h2>
        <p className="mb-4 text-xs text-muted-foreground">Kunlik buyurtmalar va tushum (so&apos;m)</p>
        <div className="h-72">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 18%)" />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="hsl(217 10% 64%)" fontSize={11} />
                <YAxis yAxisId="left" stroke="hsl(217 10% 64%)" fontSize={11} />
                <YAxis yAxisId="right" orientation="right" stroke="hsl(217 10% 64%)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: "hsl(224 47% 8%)", border: "1px solid hsl(215 28% 18%)" }}
                  formatter={(v: number, name: string) =>
                    name === "revenue" ? [formatUzs(v), "Tushum"] : [v, "Buyurtma"]
                  }
                  labelFormatter={(l) => shortDate(String(l))}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="orders" name="Buyurtmalar" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="revenue"
                  name="Tushum"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Bu davrda buyurtma yo&apos;q
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card">
          <h2 className="mb-1 text-base font-semibold">Buyurtma holatlari</h2>
          <p className="mb-4 text-xs text-muted-foreground">Status bo&apos;yicha taqsimot</p>
          <div className="h-64">
            {(data?.orders_by_status.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.orders_by_status}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {data?.orders_by_status.map((entry) => (
                      <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#64748b"} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(224 47% 8%)", border: "1px solid hsl(215 28% 18%)" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">Ma&apos;lumot yo&apos;q</p>
            )}
          </div>
        </div>

        <div className="admin-card">
          <h2 className="mb-1 text-base font-semibold">Bozor blok trafik — {marketLabel}</h2>
          <p className="mb-4 text-xs text-muted-foreground">Qavat/blok bo&apos;yicha oyoq oqimi</p>
          <div className="h-64">
            {(data?.market.block_footfall.length ?? 0) > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.market.block_footfall}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 18%)" />
                  <XAxis dataKey="block" stroke="hsl(217 10% 64%)" fontSize={11} />
                  <YAxis stroke="hsl(217 10% 64%)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: "hsl(224 47% 8%)", border: "1px solid hsl(215 28% 18%)" }}
                    formatter={(v: number) => [v, "Trafik"]}
                  />
                  <Bar dataKey="hits" name="Trafik" radius={[4, 4, 0, 0]}>
                    {data?.market.block_footfall.map((_, i) => (
                      <Cell key={i} fill={BLOCK_COLORS[i % BLOCK_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Blok trafik ma&apos;lumoti yo&apos;q
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="admin-card">
          <h2 className="mb-4 text-base font-semibold">Top qidiruvlar</h2>
          <div className="admin-scroll-x">
            <table className="admin-table min-w-full">
              <thead>
                <tr>
                  <th>#</th>
                  <th>So&apos;rov</th>
                  <th>Soni</th>
                  <th>Ulush</th>
                </tr>
              </thead>
              <tbody>
                {(data?.market.top_searches ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted-foreground">
                      Qidiruv yo&apos;q
                    </td>
                  </tr>
                ) : (
                  data?.market.top_searches.map((row, i) => {
                    const pct = s?.total_searches
                      ? Math.round((row.count / s.total_searches) * 100)
                      : 0;
                    return (
                      <tr key={row.query}>
                        <td className="text-muted-foreground">{i + 1}</td>
                        <td className="max-w-[180px] truncate font-medium">{row.query}</td>
                        <td>{row.count}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="admin-card">
          <h2 className="mb-4 text-base font-semibold">Top do&apos;konlar (savdo)</h2>
          <div className="admin-scroll-x">
            <table className="admin-table min-w-[420px]">
              <thead>
                <tr>
                  <th>Do&apos;kon</th>
                  <th>Buyurtma</th>
                  <th>Tushum</th>
                </tr>
              </thead>
              <tbody>
                {(data?.top_shops ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-muted-foreground">
                      Do&apos;kon savdosi yo&apos;q
                    </td>
                  </tr>
                ) : (
                  data?.top_shops.map((shop) => (
                    <tr key={shop.shop_id}>
                      <td className="font-medium">{shop.shop_name}</td>
                      <td>{shop.orders}</td>
                      <td className="font-semibold text-emerald-400">{formatUzs(shop.revenue_uzs)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {chartData.some((d) => d.users > 0) ? (
        <div className="admin-card">
          <h2 className="mb-1 text-base font-semibold">Yangi foydalanuvchilar</h2>
          <p className="mb-4 text-xs text-muted-foreground">Kunlik ro&apos;yxatdan o&apos;tish</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 18%)" />
                <XAxis dataKey="date" tickFormatter={shortDate} stroke="hsl(217 10% 64%)" fontSize={11} />
                <YAxis stroke="hsl(217 10% 64%)" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(224 47% 8%)", border: "1px solid hsl(215 28% 18%)" }}
                  labelFormatter={(l) => shortDate(String(l))}
                />
                <Bar dataKey="users" name="Foydalanuvchilar" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : null}
    </div>
  );
}
