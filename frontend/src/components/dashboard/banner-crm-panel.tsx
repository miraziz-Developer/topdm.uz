"use client";

import { motion } from "framer-motion";
import {
  Clock,
  Coins,
  CreditCard,
  Eye,
  MousePointerClick,
  Percent,
  RefreshCw,
  Sparkles,
  Upload,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

import { CarouselSettingsPanel } from "@/components/dashboard/carousel-settings-panel";
import { CrmBalanceWidget } from "@/components/dashboard/crm-balance-widget";
import { DepositInvoiceModal } from "@/components/dashboard/deposit-invoice-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PremiumSelect } from "@/components/ui/premium-select";
import {
  useCoinPackages,
  useCrmCarouselSettings,
  useCrmBannerMutations,
  useCrmBannerStats,
  useCrmBannerTariffs,
  useCrmMerchantWallet,
  useCrmMyBanners,
} from "@/hooks/useMerchantBannerCrm";
import { resolveMediaUrl, shouldUnoptimizeProductImage } from "@/lib/media";
import { cn, formatNumber } from "@/lib/utils";
import type { BannerLifecycleStatus, CrmBannerCampaign, CrmTariff } from "@/types/crm-banner";
import type { PremiumTariffCode } from "@/types/premium-banner";

const TARIFF_STYLES: Record<PremiumTariffCode, string> = {
  gold: "border-amber-400/50 bg-gradient-to-br from-amber-50 to-yellow-50 ring-amber-300/40",
  silver: "border-slate-300/60 bg-gradient-to-br from-slate-50 to-white ring-slate-200/60",
  bronze: "border-border-subtle bg-surface ring-border-subtle",
};

function formatCountdown(totalSeconds: number): string {
  if (totalSeconds <= 0) return "00:00:00";
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (d > 0) return `${d} kun ${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function statusBadge(status: BannerLifecycleStatus) {
  const map: Record<BannerLifecycleStatus, string> = {
    pending_payment: "bg-amber-500/15 text-amber-700 border-amber-400/30",
    active: "bg-emerald-500/15 text-emerald-700 border-emerald-400/30",
    expired: "bg-neutral-500/15 text-neutral-600 border-neutral-400/30",
    cancelled: "bg-red-500/15 text-red-600 border-red-400/30",
    rejected: "bg-red-500/15 text-red-700 border-red-400/40",
  };
  const labels: Record<BannerLifecycleStatus, string> = {
    pending_payment: "To'lov kutilmoqda",
    active: "Jonli reklama",
    expired: "Muddati tugagan",
    cancelled: "Bekor qilingan",
    rejected: "Rad etilgan",
  };
  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", map[status])}>
      {labels[status]}
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
    >
      <div className={cn("mb-3 flex h-10 w-10 items-center justify-center rounded-xl", accent)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-400">{label}</p>
      <p className="price-mono mt-1 text-3xl font-bold text-text-100">{typeof value === "number" ? formatNumber(value) : value}</p>
    </motion.div>
  );
}

function LiveCountdown({ secondsRemaining }: { secondsRemaining: number }) {
  const [left, setLeft] = useState(secondsRemaining);

  useEffect(() => {
    setLeft(secondsRemaining);
  }, [secondsRemaining]);

  useEffect(() => {
    if (left <= 0) return;
    const t = window.setInterval(() => setLeft((v) => Math.max(0, v - 1)), 1000);
    return () => window.clearInterval(t);
  }, [left]);

  return (
    <motion.div
      className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent px-4 py-3"
      animate={{ boxShadow: left < 86400 ? ["0 0 0 rgba(251,191,36,0)", "0 0 24px rgba(251,191,36,0.25)", "0 0 0 rgba(251,191,36,0)"] : undefined }}
      transition={{ duration: 2, repeat: left < 86400 ? Infinity : 0 }}
    >
      <Clock className="h-5 w-5 text-amber-600" aria-hidden />
      <motion.div>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-700/80">Qolgan vaqt</p>
        <p className="price-mono text-2xl font-bold tabular-nums text-amber-900">{formatCountdown(left)}</p>
      </motion.div>
    </motion.div>
  );
}

function CampaignCard({
  campaign,
  onPay,
  onRenew,
  selected,
  onSelect,
}: {
  campaign: CrmBannerCampaign;
  onPay: () => void;
  onRenew: () => void;
  selected: boolean;
  onSelect: () => void;
}) {
  const nearExpiry = campaign.status === "active" && campaign.seconds_remaining < 3 * 86400;
  const showRenew = campaign.status === "expired" || nearExpiry;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border p-4 text-left transition",
        selected ? "border-gold-500/50 bg-gold-500/5 ring-2 ring-gold-500/20" : "border-border-subtle bg-surface hover:border-gold-500/30",
      )}
    >
      <motion.div className="flex gap-4">
        <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-ink-900">
          <Image src={resolveMediaUrl(campaign.image_url)} alt="" fill className="object-cover" sizes="112px" unoptimized={shouldUnoptimizeProductImage(resolveMediaUrl(campaign.image_url))} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(campaign.status)}
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", TARIFF_STYLES[campaign.tariff_code])}>
              {campaign.tariff_label}
            </span>
          </div>
          <p className="mt-1 truncate font-semibold text-text-100">{campaign.title || "Premium banner"}</p>
          <p className="text-xs text-text-400">
            Navbat #{campaign.queue_position ?? "—"} · {campaign.package_days ?? "—"} kun
          </p>
          {campaign.status === "active" ? (
            <p className="mt-2 text-xs text-text-400">
              CTR {campaign.ctr_percent}% · {formatNumber(campaign.impressions_count)} ko&apos;rish
            </p>
          ) : null}
        </div>
      </motion.div>
      {campaign.status === "pending_payment" ? (
        <Button className="mt-3 w-full" size="sm" onClick={(e) => { e.stopPropagation(); onPay(); }}>
          To&apos;lovni tasdiqlash
        </Button>
      ) : null}
      {showRenew ? (
        <Button className="mt-3 w-full" size="sm" variant="secondary" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={(e) => { e.stopPropagation(); onRenew(); }}>
          Reklamani yangilash
        </Button>
      ) : null}
    </button>
  );
}

export function BannerCrmPanel() {
  const { data: tariffsData } = useCrmBannerTariffs();
  const { data: packagesData } = useCoinPackages();
  const { data: carouselData } = useCrmCarouselSettings();
  const { data: wallet } = useCrmMerchantWallet();
  const { data: campaignsData, isLoading, refetch } = useCrmMyBanners();
  const { create, verify, renew, buyWithCoins, topUp, saveCarousel } = useCrmBannerMutations();
  const [depositOpen, setDepositOpen] = useState(false);

  const [tariffCode, setTariffCode] = useState<PremiumTariffCode>("silver");
  const [title, setTitle] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingBannerId, setPendingBannerId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selectedPackageId, setSelectedPackageId] = useState<string>("");

  const tariffs = tariffsData?.items ?? [];
  const campaigns = campaignsData?.items ?? [];

  const activeCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedId) ?? campaigns.find((c) => c.status === "active") ?? campaigns[0],
    [campaigns, selectedId],
  );

  const { data: stats } = useCrmBannerStats(activeCampaign?.status === "active" ? activeCampaign.id : null);

  const selectedTariff = tariffs.find((t) => t.code === tariffCode) as CrmTariff | undefined;

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleCreate = async () => {
    setError("");
    if (!imageFile && !previewUrl) {
      setError("Banner rasmini yuklang.");
      return;
    }
    try {
      const res = await create.mutateAsync({
        tariff_code: tariffCode,
        title: title.trim() || undefined,
        image: imageFile ?? undefined,
      });
      setPendingBannerId(res.banner.id);
      setSelectedId(res.banner.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yaratishda xatolik");
    }
  };

  const handleVerify = async (method: "coin" | "click") => {
    const id = pendingBannerId ?? activeCampaign?.id;
    if (!id) return;
    setError("");
    try {
      await verify.mutateAsync({ banner_id: id, payment_method: method });
      setPendingBannerId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "To'lov tasdiqlanmadi");
    }
  };

  const handleBuyWithCoins = async () => {
    setError("");
    if (!imageFile && !previewUrl) {
      setError("Banner rasmini yuklang.");
      return;
    }
    try {
      await buyWithCoins.mutateAsync({
        tariff_code: tariffCode,
        title: title.trim() || undefined,
        image: imageFile ?? undefined,
      });
      setPendingBannerId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coin yetarli emas yoki xatolik");
    }
  };

  const handleTopUp = async (provider: "click") => {
    if (!selectedPackageId) {
      setError("Coin paketini tanlang.");
      return;
    }
    setError("");
    try {
      const res = await topUp.mutateAsync({
        coin_package_id: selectedPackageId,
        provider,
      });
      if (res.checkout_url) window.open(res.checkout_url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Invoice yaratilmadi");
    }
  };

  const handleRenew = async (bannerId: string) => {
    setError("");
    try {
      const res = await renew.mutateAsync({ banner_id: bannerId, tariff_code: tariffCode });
      setPendingBannerId(res.banner.id);
      setSelectedId(res.banner.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yangilashda xatolik");
    }
  };

  const impressions = stats?.impressions_count ?? activeCampaign?.impressions_count ?? 0;
  const clicks = stats?.clicks_count ?? activeCampaign?.clicks_count ?? 0;
  const ctr = stats?.ctr_percent ?? activeCampaign?.ctr_percent ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold-600">CRM Premium</p>
        <h1 className="mt-1 text-3xl font-bold text-text-100">Reklama bannerlari</h1>
        <p className="mt-1 max-w-xl text-sm text-text-400">
          Bronze (36), Silver (72), Gold (108) coin — bosh sahifa premium karusel.
        </p>
      </div>

      <CrmBalanceWidget
        balance={wallet?.coins_balance ?? wallet?.coin_balance ?? 0}
        onDeposit={() => setDepositOpen(true)}
      />

      <DepositInvoiceModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        packages={packagesData?.items ?? []}
        loading={topUp.isPending}
        onCheckout={(packageId, provider) => {
          setSelectedPackageId(packageId);
          void topUp.mutateAsync({ coin_package_id: packageId, provider }).then((res) => {
            if (res.checkout_url) window.open(res.checkout_url, "_blank", "noopener,noreferrer");
          });
        }}
      />

      {carouselData?.carousel ? (
        <CarouselSettingsPanel
          initial={{
            enabled: Boolean((carouselData.carousel as { enabled?: boolean }).enabled ?? true),
            crossfade: Boolean((carouselData.carousel as { crossfade?: boolean }).crossfade ?? true),
            autoplay: Boolean((carouselData.carousel as { autoplay?: boolean }).autoplay ?? true),
            interval_ms: Number((carouselData.carousel as { interval_ms?: number }).interval_ms ?? 4500),
          }}
          saving={saveCarousel.isPending}
          onSave={async (patch) => {
            await saveCarousel.mutateAsync(patch);
          }}
        />
      ) : null}

      {activeCampaign?.status === "active" ? (
        <LiveCountdown secondsRemaining={activeCampaign.seconds_remaining} />
      ) : null}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ko'rishlar" value={impressions} icon={Eye} accent="bg-gold-500/10 text-gold-600" />
        <StatCard label="Bosishlar" value={clicks} icon={MousePointerClick} accent="bg-emerald-500/10 text-emerald-600" />
        <StatCard label="CTR" value={`${ctr}%`} icon={Percent} accent="bg-blue-500/10 text-blue-600" />
        <StatCard
          label="Tarif"
          value={activeCampaign?.tariff_label ?? "—"}
          icon={Sparkles}
          accent="bg-purple-500/10 text-purple-600"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-5 rounded-2xl border border-border-subtle bg-surface p-6">
          <h2 className="text-lg font-semibold text-text-100">Yangi kampaniya</h2>

          <PremiumSelect
            label="Tarif"
            value={tariffCode}
            onChange={(v) => setTariffCode(v as PremiumTariffCode)}
            options={tariffs.map((t) => ({
              value: t.code,
              label: `${t.name_uz} · ${t.coin_cost ?? t.price_coins} coin · ${t.duration_days} kun`,
            }))}
          />

          {selectedTariff ? (
            <div className={cn("rounded-xl border p-4", TARIFF_STYLES[selectedTariff.code])}>
              <p className="text-sm font-medium text-text-100">
                {selectedTariff.priority_weight}x rotatsiya · {selectedTariff.price_coins ?? 0} coin
              </p>
              <p className="mt-1 text-xs text-text-400">Navbat avtomatik hisoblanadi</p>
            </div>
          ) : null}

          <Input label="Sarlavha" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Kuz kolleksiyasi VIP" />

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border-subtle bg-canvas/50 px-4 py-8 transition hover:border-gold-500/40">
            <Upload className="mb-2 h-8 w-8 text-text-400" />
            <span className="text-sm font-medium text-text-200">Banner rasmi (vertikal)</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
          </label>

          {previewUrl ? (
            <div className="relative aspect-[16/7] overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-500">{error}</p> : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="w-full"
              leftIcon={<Coins className="h-4 w-4" />}
              isLoading={buyWithCoins.isPending}
              onClick={() => void handleBuyWithCoins()}
            >
              Coin bilan sotib olish
            </Button>
            <Button
              className="w-full"
              variant="secondary"
              leftIcon={<Zap className="h-4 w-4" />}
              isLoading={create.isPending}
              onClick={() => void handleCreate()}
            >
              To&apos;lov kutiladi
            </Button>
          </div>

          {(pendingBannerId || activeCampaign?.status === "pending_payment") ? (
            <div className="space-y-2 border-t border-border-subtle pt-4">
              <p className="text-xs font-bold uppercase tracking-wider text-text-400">To&apos;lov usuli</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button variant="secondary" size="sm" leftIcon={<Coins className="h-4 w-4" />} isLoading={verify.isPending} onClick={() => void handleVerify("coin")}>
                  Coin
                </Button>
                <Button variant="secondary" size="sm" leftIcon={<CreditCard className="h-4 w-4" />} isLoading={verify.isPending} onClick={() => void handleVerify("click")}>
                  Click
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <motion.div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-100">Kampaniyalar</h2>
            <Button variant="ghost" size="sm" leftIcon={<RefreshCw className="h-4 w-4" />} onClick={() => void refetch()}>
              Yangilash
            </Button>
          </motion.div>

          {isLoading ? (
            <motion.div className="skeleton h-32 rounded-2xl" />
          ) : campaigns.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border-subtle p-8 text-center text-sm text-text-400">
              Hali reklama yo&apos;q. Chapdan yangi banner yarating.
            </p>
          ) : (
            <div className="space-y-3">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  selected={selectedId === c.id || (!selectedId && c.id === activeCampaign?.id)}
                  onSelect={() => setSelectedId(c.id)}
                  onPay={() => {
                    setPendingBannerId(c.id);
                    setSelectedId(c.id);
                  }}
                  onRenew={() => void handleRenew(c.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
