"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  TrendingUp,
  Star,
  Megaphone,
  Rocket,
  ChevronRight,
  Coins,
} from "lucide-react";
import { toast } from "sonner";

import { CrmPageHeader } from "@/components/crm-page-header";
import { Button } from "@/components/ui/button";
import { getJson, getMerchantProducts, postJson } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  duration_days: number;
  badge: string;
  priority: number;
}
interface Revenue {
  period_days: number;
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
export default function BillingPage({
  searchParams,
}: {
  searchParams?: { embedded?: string };
}) {
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

  useEffect(() => {
    Promise.all([
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

  const handleBoost = async (boostCode: string) => {
    if (!selectedProductId) {
      toast.error("Avval mahsulot tanlang");
      return;
    }
    setBoostLoadingCode(boostCode);
    try {
      const res = await postJson<{ message?: string }>("/billing/boost/product", {
        product_id: selectedProductId,
        boost_code: boostCode,
      });
      toast.success(res.message ?? "Mahsulot boost qilindi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Boost qilishda xatolik");
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
          title="Reja va to'lovlar"
          description="Do'koningizni kengaytiring — obuna, reklama, featured mahsulotlar"
        />
      ) : null}

      {/* Revenue summary */}
      {revenue && (
        <section className="rounded-3xl border border-border-subtle bg-gradient-to-br from-electric-500/8 to-surface p-6 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-electric-500" />
            <h2 className="text-lg font-bold text-text-100">30 kunlik ko&apos;rsatkichlar</h2>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Jami savdo", value: `${fmt(revenue.gross_revenue_uzs)} so\u0027m` },
              { label: "Sof daromad", value: `${fmt(revenue.net_revenue_uzs)} so\u0027m` },
              { label: "Buyurtmalar", value: String(revenue.order_count) },
              { label: "Leadlar", value: String(revenue.lead_count) },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-border-subtle bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-400">{kpi.label}</p>
                <p className="mt-1 text-xl font-black text-text-100">{kpi.value}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-text-400">
            Platforma komissiyasi: {revenue.commission_rate_pct}% — hozirda 0% (merchant onboarding bosqichi)
          </p>
        </section>
      )}

      {/* Subscription plans */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-100">Obuna rejalari</h2>
            <p className="text-sm text-text-400">Bepuldan Pro ga — mahsulotlar, AI, analitika</p>
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
            <p className="text-sm text-text-400">Mahsulotingizni katalog tepasiga chiqaring</p>
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
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <span className="text-2xl font-black text-gold-600">{fmt(b.price_uzs)}</span>
                  <span className="ml-1 text-sm text-text-400">so\u0027m / {b.duration_days} kun</span>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void handleBoost(b.code)}
                  disabled={!selectedProductId || boostLoadingCode === b.code}
                >
                  <Star className="mr-1 h-4 w-4" />
                  {boostLoadingCode === b.code ? "Yuborilmoqda..." : "Boost"}
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-1 text-xs text-text-400">
                <Coins className="h-3 w-3" />
                {Math.max(1, Math.round(b.price_uzs / 10_000))} Coin
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Premium banner tariffs */}
      <section>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neon-500/10 text-neon-500">
            <Megaphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-100">Premium reklama banner</h2>
            <p className="text-sm text-text-400">Bosh sahifa karuselida do&apos;koningizni ko&apos;rsating</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {banners.map((t) => {
            const colors = {
              bronze: "from-amber-700/10 border-amber-700/30 text-amber-800",
              silver: "from-slate-400/10 border-slate-400/30 text-slate-700",
              gold: "from-amber-400/15 border-amber-400/40 text-amber-700",
            }[t.code] ?? "";
            return (
              <div key={t.code} className={cn("rounded-3xl border bg-gradient-to-br to-surface p-6 shadow-card", colors)}>
                <span className={cn("inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider", colors.split(" ").slice(-1)[0])}>
                  {t.badge}
                </span>
                <p className="mt-3 text-2xl font-black">{fmt(t.price_uzs)}</p>
                <p className="text-sm font-medium opacity-70">so\u0027m / {t.duration_days} kun</p>
                <p className="mt-2 text-xs opacity-60">
                  Karuselda {t.priority}-o&apos;rin · Coin: {Math.max(1, Math.round(t.price_uzs / 10_000))}
                </p>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => window.location.assign("/dashboard/banners")}
                >
                  Banner joylash →
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="rounded-3xl border border-border-subtle bg-surface p-6 shadow-card">
        <h3 className="mb-4 font-bold text-text-100">Tez-tez beriladigan savollar</h3>
        <div className="space-y-4 text-sm">
          {[
            ["Coin nima?", "1 Coin = 10,000 so\u0027m. Coin bilan obuna, boost va banner sotib olasiz."],
            ["Sinov davri bor?", "Starter va Pro uchun 14 kunlik bepul sinov. Karta talab qilinmaydi."],
            ["Komissiya qancha?", "Hozirda 0%. Kelajakda buyurtma summadan 2.5% platforma haqqi."],
            ["Obunani bekor qilsa?", "Istalgan vaqt to'xtatish mumkin. Qolgan kunlar Coin sifatida qaytariladi."],
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
