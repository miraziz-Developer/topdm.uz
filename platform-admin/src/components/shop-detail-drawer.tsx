"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, ExternalLink, Share2, Star, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getShop, getShopShareKit, rejectShop, setShopFeatured, verifyShop, type ShopItem } from "@/lib/admin-api";
import { resolveMediaUrl } from "@/lib/media";

const VERIFY_LABELS: Record<string, string> = {
  pending_ai: "AI tekshiruvda",
  pending_manual: "Moderator kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  needs_info: "Qo'shimcha ma'lumot kerak",
};

function verifyLabel(status?: string | null) {
  if (!status) return "Noma'lum";
  return VERIFY_LABELS[status] ?? status;
}

type Props = {
  shopId: string;
  tab: "pending" | "verified";
  onClose: () => void;
  onApproved?: (shop: ShopItem) => void;
};

export function ShopDetailDrawer({ shopId, tab, onClose, onApproved }: Props) {
  const qc = useQueryClient();
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("Moderator talablariga mos emas.");

  const { data: shop, isLoading } = useQuery({
    queryKey: ["admin-shop", shopId],
    queryFn: () => getShop(shopId),
  });

  const shareQ = useQuery({
    queryKey: ["share-kit", shopId],
    queryFn: () => getShopShareKit(shopId),
    enabled: Boolean(shop?.is_verified),
  });

  const approveMut = useMutation({
    mutationFn: () => verifyShop(shopId, true),
    onSuccess: () => {
      toast.success("Do'kon tasdiqlandi");
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-shop", shopId] });
      if (shop) onApproved?.(shop);
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: () => rejectShop(shopId, reason),
    onSuccess: () => {
      toast.success("Ariza rad etildi");
      setRejectOpen(false);
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const featuredMut = useMutation({
    mutationFn: (featured: boolean) => setShopFeatured(shopId, featured, 30),
    onSuccess: () => {
      toast.success("Featured yangilandi");
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-shop", shopId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coverSrc = shop?.storefront_image_url
    ? resolveMediaUrl(shop.storefront_image_url)
    : shop?.logo_url
      ? resolveMediaUrl(shop.logo_url)
      : null;
  const logoSrc = shop?.logo_url ? resolveMediaUrl(shop.logo_url) : null;
  const storefrontUrl = shareQ.data?.shop_url ?? (shop?.slug ? `https://bozorliii.online/shop/${shop.slug}` : null);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-2 sm:p-4" onClick={onClose}>
      <div
        className="admin-card flex h-full w-full max-w-lg flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-semibold">Do&apos;kon profili</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Yopish
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Yuklanmoqda...</p>
          ) : shop ? (
            <div className="space-y-5">
              {coverSrc ? (
                <div className="relative h-40 w-full overflow-hidden rounded-xl bg-secondary">
                  <Image src={coverSrc} alt={shop.name} fill className="object-cover" unoptimized />
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                {logoSrc ? (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary ring-2 ring-background">
                    <Image src={logoSrc} alt={shop.name} fill className="object-cover" unoptimized />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-semibold">{shop.name}</p>
                    {shop.is_verified ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                        <BadgeCheck className="h-3.5 w-3.5" />
                        Tasdiqlangan
                      </span>
                    ) : null}
                    {shop.is_featured ? <Star className="h-4 w-4 text-amber-400" /> : null}
                  </div>
                  {shop.slug ? <p className="text-xs text-muted-foreground">/{shop.slug}</p> : null}
                  <p className="mt-1 text-sm">
                    <span className="admin-badge admin-badge-pending">{verifyLabel(shop.verification_status)}</span>
                  </p>
                </div>
              </div>

              {shop.verification_reason ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                  {shop.verification_reason}
                </div>
              ) : null}

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Egasi</dt>
                  <dd className="font-medium">{shop.owner_display_name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Telefon</dt>
                  <dd>{shop.owner_phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="break-all">{shop.owner_email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Telegram</dt>
                  <dd>{shop.telegram_connected ? "Ulangan" : "Ulanmagan"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Bozor / hudud</dt>
                  <dd>{shop.ipadrom_name ?? shop.market_zone ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Manzil</dt>
                  <dd>
                    {shop.address_label ??
                      [shop.floor, shop.section, shop.stall_number].filter(Boolean).join(" · ") ??
                      "—"}
                  </dd>
                </div>
                {shop.location_comment ? (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">Joy izohi</dt>
                    <dd>{shop.location_comment}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-muted-foreground">Do&apos;kon turi</dt>
                  <dd className="capitalize">{shop.shop_type ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Mahsulotlar</dt>
                  <dd>{shop.product_count ?? 0} ta</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Reyting</dt>
                  <dd>{shop.rating ? shop.rating.toFixed(1) : "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Manba</dt>
                  <dd>{shop.registration_source ?? "—"}</dd>
                </div>
              </dl>

              {shop.description ? (
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Tavsif</p>
                  <p className="text-sm leading-relaxed">{shop.description}</p>
                </div>
              ) : (
                <p className="text-sm italic text-muted-foreground">Tavsif kiritilmagan</p>
              )}

              {rejectOpen ? (
                <div className="space-y-2 rounded-lg border border-border bg-secondary/30 p-3">
                  <p className="text-sm font-medium">Rad etish sababi</p>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} />
                  <div className="flex gap-2">
                    <Button size="sm" variant="danger" onClick={() => rejectMut.mutate()} disabled={rejectMut.isPending}>
                      Rad etish
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setRejectOpen(false)}>
                      Bekor
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-red-400">Do&apos;kon topilmadi</p>
          )}
        </div>

        {shop ? (
          <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
            {storefrontUrl ? (
              <a
                href={storefrontUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-2 rounded-lg bg-secondary px-3 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80"
              >
                <ExternalLink className="h-4 w-4" />
                Vitrinani ko&apos;rish
              </a>
            ) : null}
            {tab === "pending" ? (
              <>
                <Button size="sm" variant="success" onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
                  <Check className="h-4 w-4" />
                  Tasdiqlash
                </Button>
                <Button size="sm" variant="danger" onClick={() => setRejectOpen(true)}>
                  <X className="h-4 w-4" />
                  Rad etish
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="secondary" onClick={() => featuredMut.mutate(!shop.is_featured)}>
                  {shop.is_featured ? "Featured o'chirish" : "Featured qilish"}
                </Button>
                {shareQ.data?.shop_url ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void navigator.clipboard.writeText(shareQ.data!.shop_url!);
                      toast.success("Havola nusxalandi");
                    }}
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </Button>
                ) : null}
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
