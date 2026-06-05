"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BadgeCheck,
  TrendingUp,
  Star,
  Megaphone,
  Rocket,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { BalanceTopUpModal, type TopUpPackage } from "@/components/balance-top-up-modal";
import { BillingWalletCard } from "@/components/billing-wallet-card";
import { MerchantBillingStatusCard } from "@/components/dashboard/merchant-billing-status-card";
import { CrmPageHeader } from "@/components/crm-page-header";
import { Button } from "@/components/ui/button";
import {
  generateCoinTopUpInvoice,
  getCoinPackages,
  getCrmMerchantWallet,
  getJson,
  getMerchantProducts,
  postJson,
  type CoinPackage,
  type MerchantWallet,
} from "@/lib/api";
import { bannerPricePerDay } from "@/lib/banner-pricing";
import { canAffordSom, formatSom, walletBalanceUzs } from "@/lib/money";
import { cn } from "@/lib/utils";

const SOM = "so'm";

/* ─── Types ───────────────────────────────────────────────────── */
interface Plan {
  code: string;
  name_uz: string;
  price_uzs_monthly: number;
  price_uzs_yearly: number;
  max_products: number;
  featured_products: number;
  ai_chat_enabled: boolean;
  analytics_full: boolean;
  description_uz: string;
  trial_days: number;
}
interface Boost {
  code: string;
  name_uz: string;
  price_uzs: number;
  duration_days: number;
  description_uz: string;
}
interface BannerTariff {
  code: string;
  name_uz: string;
  price_uzs: number;
  reference_price_uzs?: number;
  reference_days?: number;
  price_per_day_uzs?: number;
  duration_days: number;
  badge: string;
  priority: number;
  carousel_slot?: number;
  description?: string;
}
interface Revenue {
  period_days: number;
  merchant_earnings_uzs?: number;
  customer_sales_uzs?: number;
  platform_markup_uzs?: number;
  markup_pct?: number;
  gross_revenue_uzs: number;
  net_revenue_uzs: number;
  platform_fee_uzs: number;
  commission_rate_pct: number;
  order_count: number;
  lead_count: number;
}

interface SubscriptionState {
  plan: { code: string; name_uz: string };
  status: string;
  trial_active: boolean;
  trial_ends_at: string | null;
}
interface MerchantProduct {
  id: string;
  name: string;
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}

/* ─── Plan card ───────────────────────────────────────────────── */
function PlanCard({
  plan,
  current,
  loading,
  onSelectPlan,
}: {
  plan: Plan;
  current?: boolean;
  loading?: boolean;
  onSelectPlan?: (plan: Plan) => void;
}) {
  const isPro = plan.code === "pro";
  const isStarter = plan.code === "starter";
  const isFree = plan.code === "free";

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-3xl border p-6 shadow-card transition",
        isPro
          ? "border-electric-500/40 bg-gradient-to-br from-electric-500/10 to-surface ring-1 ring-electric-500/25"
          : "border-border-subtle bg-surface",
        current && "ring-2 ring-gold-500",
      )}
    >
      {isPro && (
        <span className="absolute -top-3 left-6 rounded-full bg-electric-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
          Eng mashhur
        </span>
      )}
      {current && (
        <span className="absolute -top-3 right-6 rounded-full bg-gold-500 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow">
          Joriy
        </span>
      )}

      <p className="text-xs font-bold uppercase tracking-widest text-text-400">{plan.name_uz}</p>
      <div className="mt-2 flex items-baseline gap-1">
        {isFree ? (
          <span className="text-3xl font-black text-text-100">Bepul</span>
        ) : (
          <>
            <span className="text-3xl font-black text-text-100">{fmt(plan.price_uzs_monthly)}</span>
            <span className="text-sm text-text-400">so&apos;m/oy</span>
          </>
        )}
      </div>
      {!isFree && (
        <p className="mt-0.5 text-xs text-text-400">
          Yillik: {fmt(plan.price_uzs_yearly)} so&apos;m (20–33% arzon)
        </p>
      )}
      <p className="mt-3 text-sm leading-relaxed text-text-400">{plan.description_uz}</p>

      <ul className="mt-5 flex-1 space-y-2 text-sm">
        <li className="flex items-center gap-2 text-text-200">
          <BadgeCheck className="h-4 w-4 shrink-0 text-green" />
          {plan.max_products === 999_999 ? "Cheksiz mahsulot" : `${plan.max_products} ta mahsulot`}
        </li>
        <li className="flex items-center gap-2 text-text-200">
          <BadgeCheck className="h-4 w-4 shrink-0 text-green" />
          {plan.featured_products > 0 ? `${plan.featured_products} ta featured` : "Featured yo&apos;q"}
        </li>
        <li className={cn("flex items-center gap-2", plan.ai_chat_enabled ? "text-text-200" : "text-text-400 line-through")}>
          <BadgeCheck className={cn("h-4 w-4 shrink-0", plan.ai_chat_enabled ? "text-green" : "text-text-400")} />
          AI chat yordamchi
        </li>
        <li className={cn("flex items-center gap-2", plan.analytics_full ? "text-text-200" : "text-text-400 line-through")}>
          <BadgeCheck className={cn("h-4 w-4 shrink-0", plan.analytics_full ? "text-green" : "text-text-400")} />
          To&apos;liq analitika
        </li>
      </ul>

      <div className="mt-6">
        {isFree ? (
          <Button variant="secondary" className="w-full" disabled>
            Joriy reja
          </Button>
        ) : (
          <Button
            className={cn("w-full", isPro ? "bg-gradient-electric text-white" : "")}
            onClick={() => onSelectPlan?.(plan)}
            disabled={loading}
          >
            {isStarter ? "Starter boshlash" : "Pro ga o&apos;tish"}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Main page ───────────────────────────────────────────────── */
function mapTopUpPackages(items: CoinPackage[]): TopUpPackage[] {
  return items.map((p) => ({ id: p.id, name_uz: p.name_uz, amount_uzs: p.amount_uzs }));
}

export default function BillingPage({
  searchParams,
}: {
  searchParams?: { embedded?: string };
}) {
  const urlSearch = useSearchParams();
  const embedded = searchParams?.embedded === "1" || searchParams?.embedded === "true";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [banners, setBanners] = useState<BannerTariff[]>([]);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [planActionLoading, setPlanActionLoading] = useState<string | null>(null);
  const [boostLoadingCode, setBoostLoadingCode] = useState<string | null>(null);
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpPackages, setTopUpPackages] = useState<TopUpPackage[]>([]);

  const refreshWallet = async () => {
    try {
      const w = await getCrmMerchantWallet();
      setWallet(w);
    } catch {
      /* ignore */
    }
  };

  const balanceUzs = walletBalanceUzs(wallet);

  useEffect(() => {
    Promise.all([
      refreshWallet(),
      getCoinPackages().then((d) => setTopUpPackages(mapTopUpPackages(d.items))).catch(() => {}),
      getJson<{ plans: Plan[] }>("/billing/plans").then((d) => setPlans(d.plans)).catch(() => {}),
      getJson<{ packages: Boost[] }>("/billing/boost/packages").then((d) => setBoosts(d.packages)).catch(() => {}),
      getJson<{ tariffs: BannerTariff[] }>("/billing/banners/tariffs").then((d) => setBanners(d.tariffs)).catch(() => {}),
      getJson<Revenue>("/billing/revenue?days=30").then(setRevenue).catch(() => {}),
      getJson<SubscriptionState>("/billing/subscription").then(setSubscription).catch(() => {}),
      getMerchantProducts()
        .then((d) => {
          const items = d.items.map((p) => ({ id: p.id, name: p.name }));
          setProducts(items);
          if (items.length) setSelectedProductId(items[0].id);
        })
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (urlSearch.get("topup") === "1") setTopUpOpen(true);
  }, [urlSearch]);

  const handlePlanSelect = async (plan: Plan) => {
    if (plan.code === "free") return;
    setPlanActionLoading(plan.code);
    try {
      const currentCode = subscription?.plan?.code ?? "free";
      const canStartTrial = currentCode === "free" && !subscription?.trial_active && plan.trial_days > 0;
      if (canStartTrial) {
        const res = await postJson<{ message?: string }>("/billing/trial/activate", { plan_code: plan.code });
        toast.success(res.message ?? `${plan.name_uz} sinov davri boshlandi`);
      } else {
        const res = await postJson<{ message?: string }>("/billing/subscribe", { plan_code: plan.code, period: "monthly" });
        toast.success(res.message ?? `${plan.name_uz} rejasi faollashtirildi`);
      }
      const updated = await getJson<SubscriptionState>("/billing/subscription");
      setSubscription(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Obunani faollashtirib bo'lmadi");
    } finally {
      setPlanActionLoading(null);
    }
  };

  const handleTopUp = async (packageId: string, provider: "click" | "payme") => {
    setTopUpLoading(true);
    try {
      const res = await generateCoinTopUpInvoice({ coin_package_id: packageId, provider });
      if (res.checkout_url) {
        window.open(res.checkout_url, "_blank", "noopener,noreferrer");
        toast.message("To'lov oynasi ochildi", {
          description: "To'lovdan keyin balans avtomatik yangilanadi.",
        });
        setTopUpOpen(false);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "To'lov havolasi yaratilmadi");
    } finally {
      setTopUpLoading(false);
    }
  };

  const handleBoost = async (boostCode: string, priceUzs: number) => {
    if (!selectedProductId) {
      toast.error("Avval mahsulot tanlang");
      return;
    }
    if (!canAffordSom(balanceUzs, priceUzs)) {
      toast.error("Balans yetarli emas — avval to'ldiring");
      setTopUpOpen(true);
      return;
    }
    setBoostLoadingCode(boostCode);
    try {
      const res = await postJson<{ message?: string; balance_uzs?: number }>("/billing/boost/product", {
        product_id: selectedProductId,
        boost_code: boostCode,
      });
      if (typeof res.balance_uzs === "number") {
        setWallet((prev) => (prev ? { ...prev, balance_uzs: res.balance_uzs! } : prev));
      } else await refreshWallet();
      toast.success(res.message ?? "Mahsulot boost qilindi");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Boost qilishda xatolik";
      if (/Insufficient Coin/i.test(msg)) {
        toast.error("Balans yetarli emas");
        setTopUpOpen(true);
      } else {
        toast.error(msg);
      }
    } finally {
      setBoostLoadingCode(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-64 rounded-2xl" />
        {[1, 2, 3].map((i) => <div key={i} className="skeleton h-64 rounded-3xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!embedded ? (
        <CrmPageHeader
          eyebrow="Billing"
          title="Reklama balansi"
          description="Click yoki Payme — barcha narxlar so'mda. Banner va boost shu balansdan."
        />
      ) : null}

      <BalanceTopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        packages={topUpPackages}
        loading={topUpLoading}
        onCheckout={(id, provider) => void handleTopUp(id, provider)}
      />

      <BillingWalletCard wallet={wallet} onTopUp={() => setTopUpOpen(true)} />

      <MerchantBillingStatusCard />

      <section className="rounded-2xl border border-electric-500/30 bg-electric-500/10 p-5">
        <h2 className="text-base font-bold text-text-100">Sizning narxingiz — alohida</h2>
        <p className="mt-2 text-sm leading-relaxed text-text-400">
          Mahsulotga <strong className="text-text-200">o&apos;z narxingizni</strong> kiriting — statistikada shu summa
          ko&apos;rinadi. Mijoz saytda +15% ustama bilan ko&apos;radi; bu 15%{" "}
          <strong className="text-text-200">platforma daromadi</strong>, sizning &laquo;sof foydangiz&raquo; emas va
          sizdan yechib olinmaydi.
        </p>
      </section>

      {/* Revenue summary */}
      {revenue && (
        <section className="rounded-3xl border border-border-subtle bg-gradient-to-br from-electric-500/8 to-surface p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-electric-500" />
            <h2 className="text-lg font-bold text-text-100">30 kunlik ko&apos;rsatkichlar</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
            {[
              {
                label: "Sizning savdongiz",
                hint: "Kiritgan narxlaringiz bo'yicha",
                value: `${fmt(revenue.merchant_earnings_uzs ?? revenue.gross_revenue_uzs)} so'm`,
              },
              {
                label: "Buyurtmalar",
                hint: `${revenue.period_days} kun ichida`,
                value: String(revenue.order_count),
              },
              {
                label: "Murojaatlar (lead)",
                hint: "Faol leadlar",
                value: String(revenue.lead_count),
              },
              ...(revenue.customer_sales_uzs && revenue.customer_sales_uzs > (revenue.merchant_earnings_uzs ?? 0)
                ? [
                    {
                      label: "Mijozlar to'ladi",
                      hint: `Narxingiz + ~${revenue.markup_pct ?? 15}% ustama`,
                      value: `${fmt(revenue.customer_sales_uzs)} so'm`,
                    },
                  ]
                : []),
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-border-subtle bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-400">{kpi.label}</p>
                <p className="mt-1 text-xl font-black text-text-100">{kpi.value}</p>
                <p className="mt-0.5 text-[11px] text-text-400">{kpi.hint}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-text-400">
            Platforma ustamasi ({revenue.markup_pct ?? 15}%) mijoz to&apos;loviga qo&apos;shiladi — bu yerda faqat siz
            belgilagan mahsulot narxlari yig&apos;indisi ko&apos;rsatiladi.
          </p>
        </section>
      )}

      {/* Subscription plans (o'chirilgan — faqat ma'lumot) */}
      <section className="hidden">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-100">Obuna rejalari</h2>
            <p className="text-sm text-text-400">Arxiv — hozir faqat mahsulot ustamasi</p>
            {subscription ? (
              <p className="mt-1 text-xs text-text-400">
                Joriy holat: <span className="font-semibold text-text-200">{subscription.plan.name_uz}</span> ({subscription.status})
              </p>
            ) : null}
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.code}
              plan={plan}
              current={plan.code === (subscription?.plan?.code ?? "free")}
              loading={planActionLoading === plan.code}
              onSelectPlan={handlePlanSelect}
            />
          ))}
        </div>
      </section>

      {/* Featured boost */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-600">
            <Star className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-100">Mahsulot boost</h2>
            <p className="text-sm text-text-400">
              Balansdan yechiladi — mahsulot qidiruvda yuqoriroq chiqadi (video emas, mahsulot kartochkasi)
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-border-subtle bg-white p-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-400">Boost uchun mahsulot tanlang</label>
            <select
              className="w-full rounded-xl border border-border-subtle bg-surface px-3 py-2 text-sm text-text-100"
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              {products.length ? (
                products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))
              ) : (
                <option value="">Mahsulot topilmadi</option>
              )}
            </select>
          </div>
          {boosts.map((b) => (
              <div key={b.code} className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-card">
                <p className="font-bold text-text-100">{b.name_uz}</p>
                <p className="mt-1 text-sm text-text-400">{b.description_uz}</p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-2xl font-black tabular-nums text-electric-600">{formatSom(b.price_uzs)}</span>
                    <p className="text-xs text-text-400">{b.duration_days} kun</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleBoost(b.code, b.price_uzs)}
                    disabled={!selectedProductId || boostLoadingCode === b.code}
                  >
                    <Star className="mr-1 h-4 w-4" />
                    {boostLoadingCode === b.code ? "Yuborilmoqda..." : "Boost qilish"}
                  </Button>
                </div>
              </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-500/10 text-neon-500">
            <Megaphone className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-text-100">Bosh sahifa banner (karusel)</h2>
            <p className="mt-1 text-sm text-text-400">
              Bronze / Silver / Gold — faqat karuseldagi navbat farqi. Kun tanlaysiz (7–90), narx so&apos;m da.
              {banners.length ? (
                <>
                  {" "}
                  Kunlik narxlar:{" "}
                  {banners
                    .map((t) => {
                      const perDay = t.price_per_day_uzs ?? bannerPricePerDay(t);
                      return `${t.badge} ~${fmt(perDay)} ${SOM}/kun`;
                    })
                    .join(" · ")}
                </>
              ) : null}
            </p>
            <Link
              href="/dashboard/content?tab=banners"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-lg border border-border-default bg-surface px-5 text-sm font-semibold text-text-100 hover:border-gold-500/50 hover:bg-elevated"
            >
              Kontentda banner yaratish →
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-card">
        <h3 className="mb-4 font-bold text-text-100">Tez-tez beriladigan savollar</h3>
        <div className="space-y-4 text-sm">
          {[
            [
              "Balans qanday to'ldiriladi?",
              "Click yoki Payme orqali paket tanlaysiz — summa to'g'ridan-to'g'ri so'm da ko'rsatiladi. To'lovdan keyin reklama balansi yangilanadi.",
            ],
            [
              "Nima uchun bitta balans?",
              "Bosh sahifa banneri va mahsulot boost shu hisobdan to'lanadi. Reels va Stories hozir bepul.",
            ],
            [
              "To'lovdan keyin qachon ko'rinadi?",
              "Click/Payme tasdiqlangach (odatda bir necha soniya) balans yangilanadi. Banner «chop etish» — summa darhol yechiladi.",
            ],
            [
              "Banner qayerda chiqadi?",
              "Faqat bozorliii.uz bosh sahifasidagi premium karusel (aylanma banner). Mahsulot boost — alohida, katalog tepasida.",
            ],
            [
              "Oylik obuna bormi?",
              "Yo'q. Banner uchun necha kun (7, 14, 30, 60, 90) tanlaysiz — narx kuniga qarab hisoblanadi.",
            ],
          ].map(([q, a]) => (
            <div key={q} className="rounded-2xl bg-canvas p-4">
              <p className="font-semibold text-text-100">{q}</p>
              <p className="mt-1 text-text-400">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
