"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Gem, Medal, Pencil, Plus, Power, Sparkles, Upload } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { ShopPicker } from "@/components/shop-picker";
import { Button } from "@/components/ui/button";
import { Card, StatCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  createPremiumBanner,
  deactivatePremiumBanner,
  getPremiumBanners,
  getPremiumTariffs,
  updatePremiumTariff,
  uploadPremiumBannerImage,
  type PremiumBanner,
  type PremiumTariff,
  type ShopItem,
} from "@/lib/admin-api";
import { resolveMediaUrl } from "@/lib/media";
import { cn, formatDate, formatUzs } from "@/lib/utils";

const TIER_STYLE: Record<string, { icon: typeof Crown; ring: string }> = {
  gold: { icon: Crown, ring: "ring-amber-400/40" },
  silver: { icon: Gem, ring: "ring-slate-300/40" },
  bronze: { icon: Medal, ring: "ring-orange-400/30" },
};

const BANNER_TABS = [
  { value: "active" as const, label: "Faol" },
  { value: "all" as const, label: "Barchasi" },
];

function TariffEditModal({
  tariff,
  onClose,
}: {
  tariff: PremiumTariff;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [nameUz, setNameUz] = useState(tariff.name_uz);
  const [price, setPrice] = useState(String(tariff.price_uzs_monthly ?? 0));
  const [priority, setPriority] = useState(String(tariff.priority_weight));
  const [dwell, setDwell] = useState(String(tariff.dwell_ms));
  const [badge, setBadge] = useState(tariff.badge_label ?? "");
  const [days, setDays] = useState(String(tariff.duration_days ?? 30));
  const [active, setActive] = useState(tariff.is_active);

  const saveMut = useMutation({
    mutationFn: () =>
      updatePremiumTariff(tariff.id, {
        name_uz: nameUz.trim(),
        price_uzs_monthly: Number(price),
        priority_weight: Number(priority),
        dwell_ms: Number(dwell),
        badge_label: badge.trim() || null,
        duration_days: Number(days),
        is_active: active,
      }),
    onSuccess: () => {
      toast.success("Tarif yangilandi");
      void qc.invalidateQueries({ queryKey: ["premium-tariffs"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="admin-card w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold">Tarifni tahrirlash — {tariff.code}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Nomi</label>
            <Input value={nameUz} onChange={(e) => setNameUz(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Narx (so&apos;m/oy)</label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Prioritet</label>
            <Input type="number" value={priority} onChange={(e) => setPriority(e.target.value)} min={1} max={10} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Ko&apos;rinish (ms)</label>
            <Input type="number" value={dwell} onChange={(e) => setDwell(e.target.value)} step={100} />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Kunlar</label>
            <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} min={1} max={365} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs text-muted-foreground">Badge</label>
            <Input value={badge} onChange={(e) => setBadge(e.target.value)} placeholder="VIP Gold" />
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Faol tarif
          </label>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>
            Saqlash
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Bekor
          </Button>
        </div>
      </div>
    </div>
  );
}

function TariffCard({ tariff, onEdit }: { tariff: PremiumTariff; onEdit: () => void }) {
  const style = TIER_STYLE[tariff.code] ?? TIER_STYLE.bronze;
  const Icon = style.icon;
  return (
    <div className={cn("rounded-xl border border-border bg-secondary/30 p-4 ring-1", style.ring)}>
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Icon className="h-4 w-4" />
          </span>
          <div>
            <p className="font-semibold">{tariff.name_uz}</p>
            <p className="text-xs uppercase text-muted-foreground">{tariff.code}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className={cn("admin-badge", tariff.is_active ? "admin-badge-ok" : "admin-badge-danger")}>
            {tariff.is_active ? "Faol" : "O'chiq"}
          </span>
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label="Tahrirlash">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <p className="text-2xl font-bold text-primary">{formatUzs(tariff.price_uzs_monthly ?? 0)}</p>
      <p className="text-xs text-muted-foreground">/ oy</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">Prioritet</dt>
          <dd className="font-semibold">{tariff.priority_weight}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Ko&apos;rinish vaqti</dt>
          <dd className="font-semibold">{(tariff.dwell_ms / 1000).toFixed(1)}s</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">Badge</dt>
          <dd className="font-medium">{tariff.badge_label ?? "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function BannerCard({
  banner,
  onDeactivate,
  deactivating,
}: {
  banner: PremiumBanner;
  onDeactivate: (id: string) => void;
  deactivating: boolean;
}) {
  const imgSrc = resolveMediaUrl(banner.image_url);
  const isActive = banner.status === "active" && banner.is_active !== false;

  return (
    <div className="flex gap-3 rounded-xl border border-border bg-secondary/20 p-3">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {imgSrc ? (
          <Image src={imgSrc} alt={banner.headline} fill className="object-cover" unoptimized />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <Sparkles className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{banner.headline}</p>
        <p className="text-xs text-muted-foreground">{banner.shop_name}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="admin-badge admin-badge-ok">{banner.tariff_label}</span>
          <span
            className={cn(
              "admin-badge",
              isActive ? "admin-badge-ok" : "admin-badge-danger",
            )}
          >
            {isActive ? "Faol" : banner.status === "expired" ? "Muddati tugagan" : "O'chirilgan"}
          </span>
          <span className="text-xs text-muted-foreground">★ {banner.rating}</span>
          {banner.ends_at ? (
            <span className="text-xs text-muted-foreground">· {formatDate(banner.ends_at)}</span>
          ) : null}
        </div>
        {isActive ? (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2 h-8 text-destructive hover:text-destructive"
            disabled={deactivating}
            onClick={() => onDeactivate(banner.id)}
          >
            <Power className="h-3.5 w-3.5" />
            O&apos;chirish
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function PremiumPage() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [bannerTab, setBannerTab] = useState<"active" | "all">("active");
  const [selectedShop, setSelectedShop] = useState<ShopItem | null>(null);
  const [tariffCode, setTariffCode] = useState("bronze");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState("30");
  const [editTariff, setEditTariff] = useState<PremiumTariff | null>(null);

  const tariffsQ = useQuery({ queryKey: ["premium-tariffs"], queryFn: getPremiumTariffs });
  const bannersQ = useQuery({
    queryKey: ["premium-banners", bannerTab],
    queryFn: () => getPremiumBanners(bannerTab === "active"),
  });

  const createMut = useMutation({
    mutationFn: () =>
      createPremiumBanner({
        shop_id: selectedShop!.id,
        tariff_code: tariffCode,
        image_url: imageUrl.trim(),
        title: title.trim() || undefined,
        days: Number(days) || 30,
      }),
    onSuccess: () => {
      toast.success("Banner yaratildi — asosiy sahifada «Sponsorlangan do'konlar» bo'limida ko'rinadi");
      resetForm();
      void qc.invalidateQueries({ queryKey: ["premium-banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMut = useMutation({
    mutationFn: deactivatePremiumBanner,
    onSuccess: () => {
      toast.success("Banner o'chirildi");
      void qc.invalidateQueries({ queryKey: ["premium-banners"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetForm = () => {
    setShowForm(false);
    setSelectedShop(null);
    setImageUrl("");
    setImagePreview(null);
    setTitle("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!selectedShop) {
      toast.error("Avval do'konni tanlang");
      return;
    }
    setUploading(true);
    try {
      const res = await uploadPremiumBannerImage(selectedShop.id, file);
      setImageUrl(res.image_url);
      setImagePreview(URL.createObjectURL(file));
      toast.success("Rasm yuklandi");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Yuklash xatosi");
    } finally {
      setUploading(false);
    }
  };

  const tariffs = tariffsQ.data?.items ?? [];
  const banners = bannersQ.data?.items ?? [];
  const activeCount = bannerTab === "active" ? banners.length : banners.filter((b) => b.status === "active").length;
  const previewSrc = imagePreview || (imageUrl ? resolveMediaUrl(imageUrl) : "");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Faol bannerlar" value={activeCount} icon={<Sparkles className="h-5 w-5" />} tone="blue" />
        <StatCard
          label="Gold VIP"
          value={banners.filter((b) => b.tariff_code === "gold" && b.status === "active").length}
          icon={<Crown className="h-5 w-5" />}
          tone="amber"
        />
        <StatCard label="Tariflar" value={tariffs.length} icon={<Gem className="h-5 w-5" />} tone="purple" />
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold">Premium tariflar</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tariffs.map((t) => (
            <TariffCard key={t.id} tariff={t} onEdit={() => setEditTariff(t)} />
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold">Reklama bannerlari</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Faol bannerlar bozorliii.online bosh sahifasida «Sponsorlangan do&apos;konlar» karuselida va story
              halqalarida ko&apos;rinadi.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-secondary/50 p-1">
              {BANNER_TABS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setBannerTab(t.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition",
                    bannerTab === t.value ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={() => setShowForm((v) => !v)}>
              <Plus className="h-4 w-4" />
              Yangi banner
            </Button>
          </div>
        </div>

        {showForm ? (
          <Card className="mb-4 space-y-4">
            <h3 className="font-semibold">Banner yaratish (admin)</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Do&apos;kon</label>
                <ShopPicker value={selectedShop} onChange={setSelectedShop} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Tarif</label>
                <select
                  className="h-10 w-full rounded-lg border border-input bg-secondary/50 px-3 text-sm"
                  value={tariffCode}
                  onChange={(e) => setTariffCode(e.target.value)}
                >
                  <option value="bronze">Bronze</option>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Kunlar</label>
                <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} min={1} max={365} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Banner rasmi</label>
                <div className="flex flex-wrap items-start gap-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={uploading}
                    onClick={() => {
                      if (!selectedShop) {
                        toast.error("Avval do'konni tanlang");
                        return;
                      }
                      fileRef.current?.click();
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    {uploading ? "Yuklanmoqda..." : "Browse — kompyuterdan"}
                  </Button>
                  <span className="self-center text-xs text-muted-foreground">yoki URL kiriting →</span>
                  <Input
                    className="max-w-xs"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
                {previewSrc ? (
                  <div className="relative mt-3 h-32 w-48 overflow-hidden rounded-lg bg-secondary">
                    <Image src={previewSrc} alt="Preview" fill className="object-cover" unoptimized />
                  </div>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-muted-foreground">Sarlavha</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ixtiyoriy" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => createMut.mutate()}
                disabled={createMut.isPending || !selectedShop || !imageUrl.trim()}
              >
                Saqlash
              </Button>
              <Button variant="ghost" onClick={resetForm}>
                Bekor
              </Button>
            </div>
          </Card>
        ) : null}

        {bannersQ.isLoading ? (
          <Card className="py-12 text-center text-muted-foreground">Yuklanmoqda...</Card>
        ) : banners.length === 0 ? (
          <Card className="py-12 text-center text-muted-foreground">
            {bannerTab === "active" ? "Faol banner yo'q" : "Banner topilmadi"}
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {banners.map((b) => (
              <BannerCard
                key={b.id}
                banner={b}
                deactivating={deactivateMut.isPending}
                onDeactivate={(id) => {
                  if (window.confirm("Bannerni o'chirishni tasdiqlaysizmi?")) {
                    deactivateMut.mutate(id);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {editTariff ? <TariffEditModal tariff={editTariff} onClose={() => setEditTariff(null)} /> : null}
    </div>
  );
}
