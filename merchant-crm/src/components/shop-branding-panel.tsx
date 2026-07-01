"use client";

import { ExternalLink, ImagePlus, Phone, Store, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CrmSection, CrmTip } from "@/components/crm/crm-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMerchantMe,
  notifyMerchantShopUpdated,
  patchMerchantShopProfile,
  uploadMerchantShopCover,
  uploadMerchantShopLogo,
  type MerchantShopProfile,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://bozorliii.uz").replace(/\/$/, "");
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const PHONE_REGEX = /^\+998\d{9}$/;

const SHOP_TYPE_OPTIONS = [
  { value: "chakana", label: "Chakana do'kon" },
  { value: "optom", label: "Optomchi (pachka)" },
  { value: "hybrid", label: "Chakana + optom" },
] as const;

type ProfileForm = {
  name: string;
  ownerDisplayName: string;
  ownerPhone: string;
  shopType: string;
  description: string;
};

function pickImage(file: File | null): boolean {
  if (!file) return false;
  if (!ACCEPT.includes(file.type)) {
    toast.error("Faqat JPG, PNG yoki WebP");
    return false;
  }
  if (file.size > MAX_BYTES) {
    toast.error("Rasm 5 MB dan kichik bo'lsin");
    return false;
  }
  return true;
}

function formFromShop(shop: MerchantShopProfile, phoneFallback?: string | null): ProfileForm {
  return {
    name: shop.name ?? "",
    ownerDisplayName: shop.owner_display_name ?? "",
    ownerPhone: shop.owner_phone ?? phoneFallback ?? "+998",
    shopType: shop.shop_type ?? "chakana",
    description: shop.description ?? "",
  };
}

function normalizePhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "+998";
  if (digits.startsWith("998")) return `+${digits.slice(0, 12)}`;
  if (digits.length <= 9) return `+998${digits.slice(0, 9)}`;
  return `+998${digits.slice(-9)}`;
}

export function ShopBrandingPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [shop, setShop] = useState<MerchantShopProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    name: "",
    ownerDisplayName: "",
    ownerPhone: "+998",
    shopType: "chakana",
    description: "",
  });
  const [savedForm, setSavedForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);

  const refresh = useCallback(async () => {
    const me = await getMerchantMe();
    const nextForm = formFromShop(me.shop, me.phone);
    setShop(me.shop);
    setForm(nextForm);
    setSavedForm(nextForm);
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => toast.error("Profil yuklanmadi"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const dirty = useMemo(() => {
    if (!savedForm) return false;
    return (
      form.name.trim() !== savedForm.name.trim() ||
      form.ownerDisplayName.trim() !== savedForm.ownerDisplayName.trim() ||
      form.ownerPhone.trim() !== savedForm.ownerPhone.trim() ||
      form.shopType !== savedForm.shopType ||
      form.description.trim() !== savedForm.description.trim()
    );
  }, [form, savedForm]);

  const applyShop = (next: MerchantShopProfile) => {
    setShop(next);
    notifyMerchantShopUpdated(next);
  };

  const onLogo = async (file: File | null) => {
    if (!file || !pickImage(file)) return;
    setLogoBusy(true);
    try {
      const res = await uploadMerchantShopLogo(file);
      applyShop(res.shop);
      toast.success("Logo saqlandi — mijozlar saytida ko'rinadi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Logo yuklanmadi");
    } finally {
      setLogoBusy(false);
    }
  };

  const onCover = async (file: File | null) => {
    if (!file || !pickImage(file)) return;
    setCoverBusy(true);
    try {
      const res = await uploadMerchantShopCover(file);
      applyShop(res.shop);
      toast.success("Muqova saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Muqova yuklanmadi");
    } finally {
      setCoverBusy(false);
    }
  };

  const saveProfile = async () => {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Do'kon nomi kamida 2 ta belgi bo'lsin");
      return;
    }
    const phone = normalizePhoneInput(form.ownerPhone);
    if (!PHONE_REGEX.test(phone)) {
      toast.error("Telefon +998XXXXXXXXX formatida bo'lsin");
      return;
    }

    setProfileBusy(true);
    try {
      const res = await patchMerchantShopProfile({
        name,
        owner_display_name: form.ownerDisplayName.trim() || null,
        owner_phone: phone,
        shop_type: form.shopType,
        description: form.description.trim() || null,
      });
      const nextForm = formFromShop(res.shop, phone);
      setForm(nextForm);
      setSavedForm(nextForm);
      applyShop(res.shop);
      toast.success("Do'kon ma'lumotlari saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setProfileBusy(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-80 rounded-3xl" />;
  }

  if (!shop) {
    return (
      <div className="crm-surface-card py-14 text-center text-sm text-text-400">
        Do&apos;kon ma&apos;lumoti topilmadi
      </div>
    );
  }

  const logoSrc = resolveMediaUrl(shop.logo_url);
  const coverSrc = resolveMediaUrl(shop.storefront_image_url);
  const storefrontUrl = `${SITE_URL}/shop/${shop.slug}`;

  return (
    <div className="space-y-4">
      <CrmTip>
        <strong className="font-semibold text-text-100">Profil va brend</strong> mijozlar{" "}
        <strong className="text-text-200">bozorliii.uz/shop/{shop.slug}</strong> sahifasida, xaritada va mahsulot
        kartalarida chiqadi. Havola (slug) o&apos;zgarmaydi — SEO va QR xavfsiz.
      </CrmTip>

      <div className="crm-surface-card overflow-hidden">
        <div className="relative h-32 bg-gradient-to-br from-electric-500/20 to-indigo-500/10 sm:h-40">
          {coverSrc ? (
            <Image src={coverSrc} alt="" fill className="object-cover" unoptimized sizes="800px" />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          <button
            type="button"
            disabled={coverBusy}
            onClick={() => coverInputRef.current?.click()}
            className="absolute bottom-3 right-3 rounded-full bg-black/55 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm hover:bg-black/70"
          >
            {coverBusy ? "Yuklanmoqda…" : "Muqova"}
          </button>
        </div>

        <div className="flex flex-col gap-4 px-4 pb-5 sm:flex-row sm:items-end sm:px-6">
          <div className="-mt-10 relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-surface ring-4 ring-surface shadow-lg sm:h-28 sm:w-28">
            {logoSrc ? (
              <Image src={logoSrc} alt={shop.name} fill className="object-cover" unoptimized sizes="112px" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-electric-500/10 text-electric-600">
                <Store className="h-10 w-10" />
              </div>
            )}
            <button
              type="button"
              disabled={logoBusy}
              onClick={() => logoInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition hover:bg-black/40 hover:text-white"
              aria-label="Logo yuklash"
            >
              <ImagePlus className="h-8 w-8" />
            </button>
          </div>
          <div className="min-w-0 flex-1 pt-1 sm:pt-0">
            <h2 className="text-xl font-bold text-text-100">{form.name.trim() || shop.name}</h2>
            <p className="mt-0.5 text-sm text-text-400">/{shop.slug}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" disabled={logoBusy} onClick={() => logoInputRef.current?.click()}>
                {logoBusy ? "Logo…" : "Logo yuklash"}
              </Button>
              <Button type="button" size="sm" variant="secondary" disabled={coverBusy} onClick={() => coverInputRef.current?.click()}>
                {coverBusy ? "Muqova…" : "Muqova yuklash"}
              </Button>
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border-subtle px-3 text-xs font-semibold text-electric-600 hover:bg-electric-500/5"
              >
                Saytda ko&apos;rish
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <input
        ref={logoInputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        onChange={(e) => {
          void onLogo(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
      <input
        ref={coverInputRef}
        type="file"
        accept={ACCEPT.join(",")}
        className="sr-only"
        onChange={(e) => {
          void onCover(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />

      <CrmSection title="Asosiy ma'lumotlar" description="Nom, telefon va do'kon turi" icon={Store}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-400">
              Do&apos;kon nomi *
            </span>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              maxLength={200}
              placeholder="Masalan: Gulnora Fashion"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-400">
              <UserRound className="h-3.5 w-3.5" />
              Egasi ismi
            </span>
            <Input
              value={form.ownerDisplayName}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerDisplayName: e.target.value }))}
              maxLength={120}
              placeholder="Masalan: Gulnora"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-text-400">
              <Phone className="h-3.5 w-3.5" />
              Telefon *
            </span>
            <Input
              value={form.ownerPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, ownerPhone: normalizePhoneInput(e.target.value) }))}
              inputMode="tel"
              placeholder="+998901234567"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-400">
              Do&apos;kon turi
            </span>
            <select
              value={form.shopType}
              onChange={(e) => setForm((prev) => ({ ...prev, shopType: e.target.value }))}
              className={cn(
                "h-10 w-full rounded-lg border border-border-subtle bg-canvas px-3 text-sm text-text-100",
                "focus:border-electric-500/40 focus:outline-none focus:ring-2 focus:ring-electric-500/15",
              )}
            >
              {SHOP_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <div className="sm:col-span-2">
            <p className="rounded-xl border border-border-subtle bg-canvas/60 px-3 py-2 text-xs text-text-400">
              Do&apos;kon havolasi:{" "}
              <span className="font-mono font-semibold text-text-200">/{shop.slug}</span> — o&apos;zgartirish uchun
              qo&apos;llab-quvvatlashga murojaat qiling.
            </p>
          </div>
        </div>
      </CrmSection>

      <CrmSection title="Do'kon haqida" description="Mijozlar vitrinada o'qiydi" icon={Store}>
        <textarea
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          rows={4}
          maxLength={2000}
          placeholder="Masalan: Ayollar kiyimi va aksessuarlar — yangi kolleksiya har hafta"
          className={cn(
            "w-full rounded-xl border border-border-subtle bg-canvas px-3 py-2.5 text-sm text-text-100",
            "placeholder:text-text-400 focus:border-electric-500/40 focus:outline-none focus:ring-2 focus:ring-electric-500/15",
          )}
        />
        <p className="mt-1 text-xs text-text-400">{form.description.length}/2000</p>
      </CrmSection>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="border-0 bg-electric-500 text-white hover:bg-electric-600"
          disabled={profileBusy || !dirty}
          onClick={() => void saveProfile()}
        >
          {profileBusy ? "Saqlanmoqda…" : "O'zgarishlarni saqlash"}
        </Button>
        {dirty ? (
          <button
            type="button"
            className="text-sm font-medium text-text-400 hover:text-text-200"
            disabled={profileBusy}
            onClick={() => savedForm && setForm(savedForm)}
          >
            Bekor qilish
          </button>
        ) : null}
      </div>

      <p className="text-center text-xs text-text-400">
        Keyingi qadam:{" "}
        <Link href="/dashboard/shop?tab=share" className="font-semibold text-electric-600 underline">
          Ulashish
        </Link>{" "}
        — QR va havola
      </p>
    </div>
  );
}
