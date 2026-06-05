"use client";

import { ImagePlus, Megaphone, RefreshCw, Wallet, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  buyCrmBannerWithCoins,
  getCrmBannerTariffs,
  getCrmMerchantWallet,
  getCrmMyBanners,
  renewCrmBanner,
  type CrmBannerCampaign,
  type CrmTariff,
  type MerchantWallet,
} from "@/lib/api";
import {
  BANNER_DAY_OPTIONS,
  bannerPriceForDays,
  bannerPricePerDay,
  formatUzs,
} from "@/lib/banner-pricing";
import { canAffordSom, formatSom, walletBalanceUzs } from "@/lib/money";
import { resolveMediaUrl } from "@/lib/media";
import { cn, formatNumber } from "@/lib/utils";

const STATUS_UZ: Record<string, { label: string; variant: "default" | "success" | "warning" | "danger" }> = {
  active: { label: "Faol", variant: "success" },
  pending: { label: "Tekshirilmoqda", variant: "warning" },
  expired: { label: "Tugagan", variant: "default" },
  rejected: { label: "Rad etilgan", variant: "danger" },
};

function bannerErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (/Insufficient Coin/i.test(msg) || /insufficient_coins/i.test(msg)) {
    return "Balans yetarli emas — Do'kon → Reja bo'limida to'ldiring.";
  }
  if (/image_required|empty_image/i.test(msg)) {
    return "Reklama rasmini tanlang (JPG yoki PNG).";
  }
  if (/unknown_tariff/i.test(msg)) return "Tarif topilmadi — sahifani yangilang.";
  return msg || "Saqlab bo'lmadi";
}

function BannerJournalRow({
  banner,
  busy,
  onRenew,
}: {
  banner: CrmBannerCampaign;
  busy: boolean;
  onRenew: () => void;
}) {
  const meta = STATUS_UZ[banner.status] ?? { label: banner.status, variant: "default" as const };
  const img = resolveMediaUrl(banner.image_url);
  const daysLeft = Math.max(0, Math.ceil(banner.seconds_remaining / 86400));

  return (
    <article className="border-b border-border-subtle/80 px-4 py-4 last:border-b-0 sm:px-5">
      <div className="flex gap-3 sm:gap-4">
        <div
          className={cn(
            "mt-1 w-1 shrink-0 self-stretch min-h-[5rem] rounded-full",
            banner.is_active ? "bg-electric-500" : "bg-border-subtle",
          )}
          aria-hidden
        />

        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-2xl bg-canvas ring-1 ring-border-subtle sm:h-24 sm:w-40">
          {img ? (
            <Image src={img} alt="" fill className="object-cover" sizes="160px" unoptimized />
          ) : (
            <div className="flex h-full items-center justify-center text-text-400/50">
              <ImagePlus className="h-8 w-8" />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-text-100">{banner.title || banner.tariff_label}</h3>
              <p className="mt-0.5 text-sm text-text-400">{banner.tariff_label}</p>
            </div>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </div>

          <p className="mt-2 text-sm text-text-400">
            {banner.is_active ? (
              <>
                Yana <strong className="text-text-100">{daysLeft}</strong> kun ko&apos;rinadi
              </>
            ) : (
              "Muddati tugagan"
            )}
            <span className="mx-1.5 text-border-subtle">·</span>
            Ko&apos;rildi: {formatNumber(banner.impressions_count)} · Bosildi: {formatNumber(banner.clicks_count)}
          </p>

          {banner.status === "expired" ? (
            <Button type="button" size="sm" variant="secondary" className="mt-3" disabled={busy} onClick={onRenew}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", busy && "animate-spin")} />
              Davom ettirish
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function BannerCrmPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wallet, setWallet] = useState<MerchantWallet | null>(null);
  const [tariffs, setTariffs] = useState<CrmTariff[]>([]);
  const [banners, setBanners] = useState<CrmBannerCampaign[]>([]);
  const [tariffCode, setTariffCode] = useState("gold");
  const [bannerDays, setBannerDays] = useState<number>(30);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    const [w, t, b] = await Promise.all([
      getCrmMerchantWallet(),
      getCrmBannerTariffs(),
      getCrmMyBanners(),
    ]);
    setWallet(w);
    setTariffs(t.items);
    setBanners(b.items);
    if (t.items.length && !t.items.some((x) => x.code === tariffCode)) {
      setTariffCode(t.items[0]?.code ?? "gold");
    }
  }, [tariffCode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) toast.error("Ma'lumot yuklanmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const selectedTariff = tariffs.find((t) => t.code === tariffCode);
  const quote = selectedTariff ? bannerPriceForDays(selectedTariff, bannerDays) : null;
  const amountUzs = quote?.amountUzs ?? 0;
  const balanceUzs = walletBalanceUzs(wallet);
  const canAfford = canAffordSom(balanceUzs, amountUzs);
  const dayOptions =
    selectedTariff?.day_options?.length ? selectedTariff.day_options : [...BANNER_DAY_OPTIONS];

  const pickFile = (next: File | null) => {
    if (!next) return;
    if (!next.type.startsWith("image/")) {
      toast.error("Faqat rasm (JPG, PNG)");
      return;
    }
    if (next.size > 10 * 1024 * 1024) {
      toast.error("Rasm 10 MB dan kichik bo'lsin");
      return;
    }
    setFile(next);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(next);
    });
  };

  const clearFile = () => {
    setFile(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const purchase = async () => {
    if (!file) {
      toast.error("Avval reklama rasmini tanlang");
      return;
    }
    if (!canAfford) {
      toast.error("Balans yetarli emas");
      return;
    }
    setSubmitting(true);
    try {
      await buyCrmBannerWithCoins({
        tariff_code: tariffCode,
        duration_days: bannerDays,
        image: file,
        title: title.trim() || undefined,
      });
      toast.success("Reklama yuborildi — tez orada bosh sahifada chiqadi");
      clearFile();
      setTitle("");
      await refresh();
    } catch (err) {
      toast.error(bannerErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renew = async (bannerId: string) => {
    setSubmitting(true);
    try {
      await renewCrmBanner({ banner_id: bannerId, tariff_code: tariffCode, duration_days: bannerDays });
      toast.success("Reklama uzaytirildi");
      await refresh();
    } catch (err) {
      toast.error(bannerErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-80 rounded-3xl" />;
  }

  const activeCount = banners.filter((b) => b.is_active).length;

  return (
    <div className="space-y-4">
      <div className="crm-surface-card p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-text-400">
          <strong className="font-semibold text-text-100">Bosh sahifa karuseli</strong> — mijozlar{" "}
          <strong className="text-text-200">bozorliii.uz</strong> ga kirganda yuqoridagi aylanma bannerda sizning
          rasmingiz chiqadi (Bronze/Silver/Gold — qaysi qatorda turishingizga qarab). Bu oylik obuna emas:{" "}
          <strong className="text-text-200">necha kun kerak bo&apos;lsa, shuncha to&apos;laysiz</strong>.
        </p>
      </div>

      <div className="crm-surface-card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600">
            <Wallet className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Reklama balansi</p>
            <p className="text-xl font-bold tabular-nums text-text-100">{formatSom(balanceUzs)}</p>
          </div>
        </div>
        <Link
          href="/dashboard/billing?topup=1"
          className="inline-flex h-9 items-center rounded-xl border border-border-subtle bg-canvas px-4 text-sm font-semibold text-text-100 hover:bg-surface"
        >
          Balans to&apos;ldirish
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="crm-surface-card p-4 sm:p-5">
          <div className="flex items-center gap-2 text-electric-600">
            <Megaphone className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider text-text-400">Hozir ekranda</span>
          </div>
          <p className="mt-2 text-3xl font-bold tabular-nums text-text-100">{activeCount}</p>
          <p className="text-sm text-text-400">faol reklama</p>
        </div>
        <div className="crm-surface-card p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-400">Tanlangan paket</p>
          <p className="mt-2 text-lg font-bold tabular-nums text-text-100">
            {quote ? formatSom(amountUzs) : "—"}
          </p>
          <p className="text-sm text-text-400">
            {quote ? `${quote.days} kun karuselda` : "Tarif va kun tanlang"}
          </p>
        </div>
      </div>

      <div className="crm-surface-card overflow-hidden">
        <div className="border-b border-border-subtle bg-canvas/50 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-text-100">Yangi reklama</h2>
          <p className="mt-0.5 text-sm text-text-400">Rasm tanlang, tarifni belgilang, chop eting</p>
        </div>

        <div className="space-y-4 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="banner-tariff" className="text-xs font-semibold text-text-400">
                Qaysi joy (karusel qatori)?
              </label>
              <select
                id="banner-tariff"
                className="mt-1.5 w-full rounded-xl border border-border-subtle bg-canvas px-3 py-2.5 text-sm font-medium text-text-100 focus:border-electric-500/40 focus:outline-none focus:ring-2 focus:ring-electric-500/15"
                value={tariffCode}
                onChange={(e) => setTariffCode(e.target.value)}
              >
                {tariffs.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name_uz} — karusel {t.carousel_slot ?? t.priority_weight ?? 1}-o&apos;rin · ~
                    {formatUzs(bannerPricePerDay(t))} so&apos;m/kun
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-text-400">Necha kun ko&apos;rinsin?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {dayOptions.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setBannerDays(d)}
                    className={cn(
                      "rounded-full px-3.5 py-1.5 text-sm font-semibold transition",
                      bannerDays === d
                        ? "bg-electric-500 text-white"
                        : "border border-border-subtle bg-canvas text-text-400 hover:text-text-100",
                    )}
                  >
                    {d} kun
                  </button>
                ))}
              </div>
            </div>
            <Input
              label="Sarlavha (ixtiyoriy)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Yangi kolleksiya"
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />

          {!previewUrl ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border-subtle bg-canvas/50 px-4 py-12 transition hover:border-electric-500/35 hover:bg-electric-500/[0.03]"
            >
              <ImagePlus className="h-10 w-10 text-electric-500/70" />
              <p className="mt-3 text-sm font-semibold text-text-100">Reklama rasmini tanlash</p>
              <p className="mt-1 text-xs text-text-400">JPG yoki PNG · gorizontal rasm yaxshiroq</p>
            </button>
          ) : (
            <div className="relative overflow-hidden rounded-2xl ring-1 ring-border-subtle">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Tanlangan reklama" className="max-h-64 w-full object-cover" />
              <button
                type="button"
                onClick={clearFile}
                className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur-sm hover:bg-black/70"
                aria-label="Rasmni olib tashlash"
              >
                <X className="h-4 w-4" />
              </button>
              <p className="border-t border-border-subtle bg-canvas/80 px-3 py-2 text-xs text-text-400 truncate">
                {file?.name}
              </p>
            </div>
          )}

          {selectedTariff && quote ? (
            <div className="rounded-xl bg-canvas/80 px-3 py-3 text-sm text-text-400">
              <p>
                <strong className="text-text-100">{selectedTariff.name_uz}</strong>
                <span className="mx-1.5">·</span>
                {quote.days} kun karuselda
                <span className="mx-1.5">·</span>
                <strong className="text-text-100">{formatSom(amountUzs)}</strong>
                <span className="text-text-400"> ({formatUzs(bannerPricePerDay(selectedTariff))} so&apos;m/kun)</span>
              </p>
              {!canAfford ? (
                <p className="mt-2 text-amber-800">
                  Balans yetarli emas ({formatSom(balanceUzs)} / {formatSom(amountUzs)}) —{" "}
                  <Link href="/dashboard/billing?topup=1" className="font-semibold text-electric-600 underline">
                    balans to&apos;ldiring
                  </Link>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={submitting || !file || !canAfford}
              className="border-0 bg-electric-500 text-white hover:bg-electric-600 disabled:opacity-50"
              onClick={() => void purchase()}
            >
              {submitting ? "Yuborilmoqda…" : "Reklamani chop etish"}
            </Button>
            {previewUrl ? (
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Boshqa rasm
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="crm-surface-card overflow-hidden">
        <div className="border-b border-border-subtle bg-canvas/50 px-4 py-2.5 sm:px-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-400">
            Mening reklamalarim · {banners.length} ta
          </p>
        </div>
        {banners.length === 0 ? (
          <div className="py-14 text-center">
            <Megaphone className="mx-auto h-10 w-10 text-text-400/45" />
            <p className="mt-3 font-medium text-text-100">Hali reklama yo&apos;q</p>
            <p className="mt-1 text-sm text-text-400">Yuqorida rasm yuklab, birinchi reklamangizni yarating</p>
          </div>
        ) : (
          banners.map((b) => (
            <BannerJournalRow key={b.id} banner={b} busy={submitting} onRenew={() => void renew(b.id)} />
          ))
        )}
      </div>
    </div>
  );
}
