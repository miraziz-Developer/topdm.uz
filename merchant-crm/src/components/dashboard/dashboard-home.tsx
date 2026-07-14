"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Eye,
  Film,
  MessageCircle,
  Package,
  Plus,
  Rocket,
  ShoppingBag,
  Sparkles,
  UserRound,
} from "lucide-react";

import { MerchantBillingStatusCard } from "@/components/dashboard/merchant-billing-status-card";
import { ShopShareKitPanel } from "@/components/shop-share-kit-panel";
import { TodayTasksPanel } from "@/components/today-tasks-panel";
import { getMerchantDashboard, getMerchantMe, getMerchantToday } from "@/lib/api";
import { cn } from "@/lib/utils";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002").replace(/\/$/, "");

function formatTodayUz() {
  return new Date().toLocaleDateString("uz-UZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [shopName, setShopName] = useState<string | null>(null);
  const [shopSlug, setShopSlug] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    total_products: number;
    total_leads: number;
    total_views: number;
    total_visits: number;
  } | null>(null);
  const [orderCount, setOrderCount] = useState(0);
  const [today, setToday] = useState<Awaited<ReturnType<typeof getMerchantToday>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // BUG FIX: Har bir API alohida try/catch — biri xato bo'lsa boshqalari ishlaydi
        const [dashboardResult, meResult, todayResult] = await Promise.allSettled([
          getMerchantDashboard(),
          getMerchantMe(),
          getMerchantToday(),
        ]);
        if (cancelled) return;

        if (dashboardResult.status === "fulfilled") {
          setStats(dashboardResult.value.stats);
          // BUG FIX: orderCount faqat faol buyurtmalar (completed/cancelled emas)
          const activeOrders = (dashboardResult.value.orders ?? []).filter(
            (o) => !["completed", "cancelled"].includes(o.status),
          );
          setOrderCount(activeOrders.length);
        }
        if (meResult.status === "fulfilled") {
          setShopName(meResult.value.shop?.name ?? null);
          setShopSlug(meResult.value.shop?.slug ?? null);
        }
        if (todayResult.status === "fulfilled") {
          setToday(todayResult.value);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useMemo(
    () => [
      {
        label: "Faol buyurtma",
        value: today?.counts.pending_orders ?? 0,
        href: "/dashboard/sales?tab=orders",
        icon: ShoppingBag,
        tone: "text-primary",
        bg: "bg-primary/10",
      },
      {
        label: "Javob kutilayotgan chat",
        value: today?.counts.chats_waiting ?? 0,
        href: "/dashboard/chat",
        icon: MessageCircle,
        tone: "text-violet-600",
        bg: "bg-violet-500/10",
      },
      {
        label: "Ochiq murojaat",
        value: today?.counts.open_leads ?? 0,
        href: "/dashboard/sales?tab=leads",
        icon: UserRound,
        tone: "text-amber-700",
        bg: "bg-amber-500/10",
      },
      {
        label: "Ko'rishlar",
        value: stats?.total_views ?? 0,
        href: "/dashboard/shop?tab=analytics",
        icon: Eye,
        tone: "text-emerald-700",
        bg: "bg-emerald-500/10",
      },
    ],
    [today, stats],
  );

  const hubs = useMemo(
    () => [
      {
        href: "/dashboard/sales?tab=orders",
        title: "Savdo",
        desc: "Buyurtmalar va murojaatlar",
        icon: ShoppingBag,
        meta: `${orderCount} buyurtma`,
      },
      {
        href: "/dashboard/chat",
        title: "Chat",
        desc: "Mijozlarga javob",
        icon: MessageCircle,
        meta: `${today?.counts.chats_waiting ?? 0} kutmoqda`,
      },
      {
        href: "/dashboard/products",
        title: "Mahsulotlar",
        desc: "Katalog va yuklash",
        icon: Package,
        meta: `${stats?.total_products ?? 0} ta`,
      },
      {
        href: "/dashboard/content?tab=reels",
        title: "Kontent",
        desc: "Reels, Stories, reklama",
        icon: Film,
        meta: `${stats?.total_views ?? 0} ko'rish`,
      },
      {
        href: "/dashboard/shop?tab=share",
        title: "Do'kon",
        desc: "Ulashish, xarita, reja",
        icon: Rocket,
        meta: `${stats?.total_visits ?? 0} tashrif`,
      },
    ],
    [orderCount, stats, today],
  );

  if (loading) {
    return (
      <div className="crm-page-enter space-y-4">
        <div className="skeleton h-36 rounded-3xl" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl" />
          ))}
        </div>
        <div className="skeleton h-64 rounded-3xl" />
      </div>
    );
  }

  const pendingTotal =
    (today?.counts.pending_orders ?? 0) +
    (today?.counts.chats_waiting ?? 0) +
    (today?.counts.open_leads ?? 0);

  return (
    <div className="crm-page-enter space-y-6">
      {/* Hero */}
      <section className="crm-hero-card overflow-hidden">
        <div className="relative border-b border-white/50 px-5 py-7 sm:px-8 sm:py-9">
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium capitalize text-muted-foreground">{formatTodayUz()}</p>
              <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                <span className="text-gradient-hero">{shopName ?? "Do'kon paneli"}</span>
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                {pendingTotal > 0 ? (
                  <>
                    Bugun <strong className="font-semibold text-foreground">{pendingTotal} ta</strong> ish
                    kutilmoqda — pastdan boshlang.
                  </>
                ) : (
                  <>Hammasi joyida. Yangi buyurtma yoki chat bo&apos;lsa, shu yerda ko&apos;rasiz.</>
                )}
              </p>
              {!today?.shop_verified ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-1 text-xs font-medium text-warning-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  {today?.verification_status === "rejected"
                    ? `Rad etildi: ${today?.verification_reason || "profilni yangilang"}`
                    : "Moderator ko'rib chiqmoqda — odatda 24 soat ichida"}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/products?tab=catalog" className="crm-btn-primary h-11 gap-2 px-5">
                <Plus className="h-4 w-4" />
                Mahsulot qo&apos;shish
              </Link>
              <Link href="/dashboard/sales?tab=orders" className="crm-btn-ghost h-11 gap-2 px-5">
                Buyurtmalar
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        <div className="relative grid grid-cols-2 divide-x divide-y divide-border/50 lg:grid-cols-4 lg:divide-y-0">
          {kpis.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Link
                key={kpi.label}
                href={kpi.href}
                className="group flex flex-col gap-3 p-4 transition duration-200 hover:bg-primary/[0.03] sm:p-5"
              >
                <div className="flex items-center justify-between">
                  <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl shadow-sm", kpi.bg)}>
                    <Icon className={cn("h-4 w-4", kpi.tone)} />
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
                <div>
                  <p className="font-display text-2xl font-semibold tabular-nums tracking-tight text-foreground">{kpi.value}</p>
                  <p className="mt-0.5 text-xs font-medium text-muted-foreground">{kpi.label}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <MerchantBillingStatusCard />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TodayTasksPanel initialData={today} />
        </div>

        <div className="crm-surface-card flex flex-col lg:col-span-2">
          <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
            <h2 className="text-sm font-semibold text-text-100">Tezkor bo&apos;limlar</h2>
            <p className="mt-0.5 text-xs text-text-400">Bir bosishda o&apos;ting</p>
          </div>
          <ul className="flex-1 divide-y divide-border-subtle/80">
            {hubs.map((hub) => {
              const Icon = hub.icon;
              return (
                <li key={hub.href}>
                  <Link
                    href={hub.href}
                    className="group flex items-center gap-3 px-4 py-3.5 transition hover:bg-canvas/50 sm:px-5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/10 to-violet-500/10 ring-1 ring-primary/15">
                      <Icon className="h-4 w-4 text-primary" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-100">{hub.title}</p>
                      <p className="text-xs text-text-400">{hub.desc}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-xs font-medium tabular-nums text-text-300">{hub.meta}</p>
                      <ArrowRight className="ml-auto mt-1 h-3.5 w-3.5 text-text-400 opacity-0 transition group-hover:opacity-100" />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {shopSlug ? (
            <div className="border-t border-border-subtle p-4 sm:px-5">
              <a
                href={`${SITE_URL}/shop/${shopSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl bg-canvas px-3 py-2.5 text-xs font-semibold text-electric-600 hover:bg-electric-500/5"
              >
                Do&apos;konni ko&apos;rish (sayt)
                <ArrowUpRight className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : null}
        </div>
      </div>

      <section className="crm-surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle px-4 py-4 sm:px-5">
          <div>
            <h2 className="font-semibold text-text-100">Mijozlarga ulashish</h2>
            <p className="text-xs text-text-400">QR va tayyor matnlar</p>
          </div>
          <Link href="/dashboard/shop?tab=share" className="text-xs font-semibold text-electric-600 hover:underline">
            To&apos;liq →
          </Link>
        </div>
        <div className="p-4 sm:p-5">
          <ShopShareKitPanel compact />
        </div>
      </section>
    </div>
  );
}
