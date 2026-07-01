"use client";

import { useEffect, useState } from "react";
import { Megaphone, Star } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { BalanceTopUpModal, type TopUpPackage } from "@/components/balance-top-up-modal";
import { BillingWalletCard } from "@/components/billing-wallet-card";
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

const SOM = "so'm";

interface Boost {
  code: string;
  name_uz: string;
  price_uzs: number;
  duration_days: number;
  description_uz: string;
}

interface BannerTariff {
  code: string;
  badge: string;
  name_uz?: string;
  price_per_day_uzs?: number;
  price_uzs: number;
  duration_days: number;
}

function mapTopUpPackages(items: CoinPackage[]): TopUpPackage[] {
  return items.map((p) => ({
    id: p.id,
    name_uz: p.name_uz,
    amount_uzs: p.amount_uzs,
    coins: p.coins,
  }));
}

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(Math.round(n));
}

type Props = {
  autoOpenTopUp?: boolean;
};

export function AdvertisingBillingPanel({ autoOpenTopUp }: Props) {
  const [boosts, setBoosts] = useState<Boost[]>([]);
  const [banners, setBanners] = useState<BannerTariff[]>([]);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [loading, setLoading] = useState(true);
  const [boostLoadingCode, setBoostLoadingCode] = useState<string | null>(null);
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(Boolean(autoOpenTopUp));
  const [topUpLoading, setTopUpLoading] = useState(false);
  const [topUpPackages, setTopUpPackages] = useState<TopUpPackage[]>([]);

  const balanceUzs = walletBalanceUzs(wallet);

  const refreshWallet = async () => {
    try {
      setWallet(await getCrmMerchantWallet());
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    Promise.all([
      refreshWallet(),
      getCoinPackages().then((d) => setTopUpPackages(mapTopUpPackages(d.items))).catch(() => {}),
      getJson<{ packages: Boost[] }>("/billing/boost/packages").then((d) => setBoosts(d.packages)).catch(() => {}),
      getJson<{ tariffs: BannerTariff[] }>("/billing/banners/tariffs").then((d) => setBanners(d.tariffs)).catch(() => {}),
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
    if (autoOpenTopUp) setTopUpOpen(true);
  }, [autoOpenTopUp]);

  const handleTopUp = async (packageId: string, provider: "click") => {
    setTopUpLoading(true);
    try {
      const res = await generateCoinTopUpInvoice({ coin_package_id: packageId, provider });
      if (res.checkout_url) {
        window.open(res.checkout_url, "_blank", "noopener,noreferrer");
        toast.message("To'lov oynasi ochildi", {
          description: "To'lovdan keyin reklama balansi yangilanadi.",
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
      toast.error("Reklama balansi yetarli emas — to'ldiring");
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
      <div className="space-y-4">
        <div className="skeleton h-32 rounded-2xl" />
        <div className="skeleton h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BalanceTopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        packages={topUpPackages}
        loading={topUpLoading}
        onCheckout={(id, provider) => void handleTopUp(id, provider)}
      />

      <BillingWalletCard wallet={wallet} onTopUp={() => setTopUpOpen(true)} />

      <section className="crm-surface-card border border-electric-500/20 bg-electric-500/[0.04] p-4 sm:p-5">
        <p className="text-sm font-semibold text-text-100">Bu bo&apos;lim — faqat reklama</p>
        <p className="mt-1 text-sm leading-relaxed text-text-400">
          Boost va banner uchun alohida <strong className="text-text-200">reklama balansi</strong>. Savdo daromadi va
          kartaga yechish — <Link href="/dashboard/billing?tab=finance" className="font-semibold text-electric-600 hover:underline">Moliya</Link> bo&apos;limida.
        </p>
      </section>

      <section>
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-600">
            <Star className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text-100">Mahsulot boost</h2>
            <p className="text-sm text-text-400">Qidiruv va katalogda yuqoriroq — reklama balansidan yechiladi</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 rounded-2xl border border-border-subtle bg-surface p-3">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-400">
              Mahsulot
            </label>
            <select
              className="w-full rounded-xl border border-border-subtle bg-canvas px-3 py-2.5 text-sm text-text-100"
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
            <div key={b.code} className="crm-surface-card p-5">
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
                  {boostLoadingCode === b.code ? "Yuborilmoqda…" : "Boost"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="crm-surface-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neon-500/10 text-neon-500">
            <Megaphone className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold text-text-100">Bosh sahifa banner</h2>
            <p className="mt-1 text-sm text-text-400">
              bozorliii.uz karuselida ko&apos;rinish. Kunlik narxlar:{" "}
              {banners.length
                ? banners
                    .map((t) => {
                      const perDay = t.price_per_day_uzs ?? bannerPricePerDay({ ...t, name_uz: t.name_uz ?? t.badge });
                      return `${t.badge} ~${fmt(perDay)} ${SOM}/kun`;
                    })
                    .join(" · ")
                : "yuklanmoqda…"}
            </p>
            <Link
              href="/dashboard/content?tab=banners"
              className="mt-4 inline-flex h-10 items-center rounded-lg border border-border-subtle bg-canvas px-4 text-sm font-semibold text-text-100 hover:bg-surface"
            >
              Banner yaratish →
            </Link>
          </div>
        </div>
      </section>

      <section className="crm-surface-card p-5 sm:p-6">
        <h3 className="font-bold text-text-100">Reklama haqida</h3>
        <div className="mt-3 space-y-3 text-sm">
          {[
            ["Balansni qanday to'ldiraman?", "Click orqali paket tanlang — summa so'm da. Faqat reklama uchun."],
            ["Boost va banner farqi?", "Boost — mahsulot kartochkasi yuqoriga. Banner — bosh sahifa karuseli."],
            ["Reels va Stories?", "Hozir bepul — reklama balansidan yechilmaydi."],
          ].map(([q, a]) => (
            <div key={q} className="rounded-xl bg-canvas px-4 py-3">
              <p className="font-semibold text-text-100">{q}</p>
              <p className="mt-0.5 text-text-400">{a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
