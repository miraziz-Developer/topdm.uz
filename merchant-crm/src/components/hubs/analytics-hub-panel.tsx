"use client";

import { BarChart3, Eye, Route, ShoppingBag, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AnalyticsLineChart, type DailyPoint } from "@/components/charts/analytics-line-chart";
import { CrmSection, CrmTip } from "@/components/crm/crm-section";
import { getMerchantAnalyticsSummary } from "@/lib/api";
import {
  ANALYTICS_PERIODS,
  analyticsGranularityHint,
  analyticsPeriodLabel,
} from "@/lib/analytics-period";
import { cn, formatPrice } from "@/lib/utils";

export function AnalyticsHubPanel() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMerchantAnalyticsSummary>> | null>(null);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await getMerchantAnalyticsSummary(days);
        if (!cancelled) setData(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [days]);

  const periodLabel = data?.period_label ?? analyticsPeriodLabel(days);
  const granularityHint = analyticsGranularityHint(data?.granularity);

  const series: DailyPoint[] = useMemo(
    () =>
      (data?.daily_series ?? []).map((row) => ({
        date: row.date,
        label: row.label,
        views: Number(row.views ?? 0),
        leads: Number(row.leads ?? 0),
        orders: Number(row.orders ?? 0),
        map_routes: Number(row.map_routes ?? 0),
      })),
    [data?.daily_series],
  );

  const totals = data?.totals;
  const hasSeries = series.length > 0;
  const seriesHasActivity =
    hasSeries && series.some((p) => p.views + p.leads + p.orders + p.map_routes > 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <CrmTip>
          Nechta odam ko&apos;rdi, nechta buyurtma berdi — davrni tanlang (kun, oy yoki yil). Uzoq davrda grafik{" "}
          <strong className="text-text-200">{granularityHint}</strong> ko&apos;rinadi.
        </CrmTip>
        <div
          className="flex flex-wrap gap-2"
          role="group"
          aria-label="Statistika davri"
        >
          {ANALYTICS_PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                days === p.days
                  ? "bg-electric-500 text-white shadow-sm"
                  : "border border-border-subtle bg-surface text-text-400 hover:border-electric-500/30 hover:text-text-100",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && !totals ? (
        <div className="skeleton h-48 rounded-2xl" />
      ) : !totals ? (
        <div className="crm-surface-card p-6 text-center text-sm text-text-400">Ma&apos;lumot yuklanmadi</div>
      ) : (
        <>
          <p className="text-xs font-medium text-text-400">
            Tanlangan davr: <strong className="text-text-100">{periodLabel}</strong>
            {data?.granularity && data.granularity !== "day" ? (
              <span className="text-text-400"> · {granularityHint} kesim</span>
            ) : null}
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Ko'rishlar", value: totals.views, icon: Eye, tone: "text-electric-600" },
              { label: "Buyurtmalar", value: totals.orders_period, icon: ShoppingBag, tone: "text-emerald-600" },
              { label: "Murojaatlar", value: totals.leads, icon: BarChart3, tone: "text-violet-600" },
              { label: "Xarita yo'li", value: totals.map_routes_period, icon: Route, tone: "text-amber-700" },
            ].map((card) => {
              const Icon = card.icon;
              return (
                <article key={card.label} className={cn("crm-stat-tile", loading && "opacity-60")}>
                  <Icon className={cn("h-5 w-5", card.tone)} />
                  <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-text-100">{card.value}</p>
                  <p className="text-sm font-medium text-text-400">{card.label}</p>
                </article>
              );
            })}
          </div>

          {hasSeries ? (
            <div className={cn("space-y-4", loading && "pointer-events-none opacity-60")}>
              <AnalyticsLineChart
                title={`Ko'rishlar — ${periodLabel}`}
                points={series}
                lines={[{ key: "views", label: "Ko'rishlar", color: "#2563eb" }]}
                height={220}
              />
              <AnalyticsLineChart
                title={`Buyurtma va murojaat — ${periodLabel}`}
                points={series}
                lines={[
                  { key: "orders", label: "Buyurtmalar", color: "#059669" },
                  { key: "leads", label: "Murojaatlar", color: "#7c3aed" },
                ]}
                height={200}
              />
              <AnalyticsLineChart
                title={`Xarita yo'li — ${periodLabel}`}
                points={series}
                lines={[{ key: "map_routes", label: "Yo'nalishlar", color: "#d97706" }]}
                height={180}
              />
              {!seriesHasActivity ? (
                <p className="text-center text-xs text-text-400">
                  Bu davrda harakat hali kam — mijozlar saytga kirganda grafik to&apos;ladi.
                </p>
              ) : null}
            </div>
          ) : null}

          {data.conversion_hint ? (
            <div className="crm-surface-card flex items-start gap-2 p-4 sm:p-5">
              <TrendingUp className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" />
              <p className="text-sm leading-relaxed text-text-400">{data.conversion_hint}</p>
            </div>
          ) : null}

          <CrmSection title="Eng ko'p qiziqish uyg'otgan mahsulotlar" icon={BarChart3}>
            <ul className="divide-y divide-border-subtle/80">
              {data.top_products.map((p, i) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas text-sm font-bold text-electric-600">
                      {i + 1}
                    </span>
                    <span className="truncate font-medium text-text-100">{p.name}</span>
                  </div>
                  <span className="shrink-0 text-right text-sm text-text-400">
                    <span className="font-semibold text-text-100">{p.view_count}</span> ko&apos;rish
                    <span className="mx-1">·</span>
                    {formatPrice(p.price)}
                  </span>
                </li>
              ))}
            </ul>
          </CrmSection>
        </>
      )}
    </div>
  );
}
