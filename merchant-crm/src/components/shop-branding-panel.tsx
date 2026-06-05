"use client";

import { ExternalLink, ImagePlus, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CrmSection, CrmTip } from "@/components/crm/crm-section";
import { Button } from "@/components/ui/button";
import {
  getMerchantMe,
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

export function ShopBrandingPanel() {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [shop, setShop] = useState<MerchantShopProfile | null>(null);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [logoBusy, setLogoBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [descBusy, setDescBusy] = useState(false);

  const refresh = useCallback(async () => {
    const me = await getMerchantMe();
    setShop(me.shop);
    setDescription(me.shop.description ?? "");
  }, []);

  useEffect(() => {
    refresh()
      .catch(() => toast.error("Profil yuklanmadi"))
      .finally(() => setLoading(false));
  }, [refresh]);

  const onLogo = async (file: File | null) => {
    if (!file || !pickImage(file)) return;
    setLogoBusy(true);
    try {
      const res = await uploadMerchantShopLogo(file);
      setShop(res.shop);
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
      setShop(res.shop);
      toast.success("Muqova saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Muqova yuklanmadi");
    } finally {
      setCoverBusy(false);
    }
  };

  const saveDescription = async () => {
    setDescBusy(true);
    try {
      const res = await patchMerchantShopProfile({ description: description.trim() || null });
      setShop(res.shop);
      toast.success("Tavsif saqlandi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setDescBusy(false);
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
        <strong className="font-semibold text-text-100">Logo va muqova</strong> mijozlar{" "}
        <strong className="text-text-200">bozorliii.uz/shop/{shop.slug}</strong> sahifasida, xaritada va mahsulot
        kartalarida chiqadi.
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
            <h2 className="text-xl font-bold text-text-100">{shop.name}</h2>
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

      <CrmSection title="Do'kon haqida" description="Mijozlar vitrinada o'qiydi" icon={Store}>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Masalan: Ayollar kiyimi va aksessuarlar — yangi kolleksiya har hafta"
          className={cn(
            "w-full rounded-xl border border-border-subtle bg-canvas px-3 py-2.5 text-sm text-text-100",
            "placeholder:text-text-400 focus:border-electric-500/40 focus:outline-none focus:ring-2 focus:ring-electric-500/15",
          )}
        />
        <p className="mt-1 text-xs text-text-400">{description.length}/2000</p>
        <Button type="button" className="mt-3 border-0 bg-electric-500 text-white hover:bg-electric-600" disabled={descBusy} onClick={() => void saveDescription()}>
          {descBusy ? "Saqlanmoqda…" : "Tavsifni saqlash"}
        </Button>
      </CrmSection>

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
