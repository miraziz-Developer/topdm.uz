"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  Check,
  RefreshCw,
  Search,
  Star,
  Store,
  X,
} from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";
import { useState } from "react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { ShopDetailDrawer } from "@/components/shop-detail-drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getPendingShops,
  getShops,
  rejectShop,
  setShopFeatured,
  verifyShop,
  type ShopItem,
} from "@/lib/admin-api";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const VERIFY_LABELS: Record<string, string> = {
  pending_ai: "AI tekshiruvda",
  pending_manual: "Moderator kutilmoqda",
  approved: "Tasdiqlangan",
  rejected: "Rad etilgan",
  needs_info: "Qo'shimcha ma'lumot",
};

const TABS = [
  { value: "pending", label: "Kutilayotgan", icon: RefreshCw },
  { value: "verified", label: "Tasdiqlangan", icon: BadgeCheck },
  { value: "all", label: "Barchasi", icon: Store },
];

export default function ShopsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "verified" | "all">("pending");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("Moderator talablariga mos emas.");
  const [detailId, setDetailId] = useState<string | null>(null);

  const pendingQ = useQuery({
    queryKey: ["pending-shops"],
    queryFn: getPendingShops,
    enabled: tab === "pending",
  });

  const verifiedQ = useQuery({
    queryKey: ["verified-shops", query],
    queryFn: () => getShops({ verified: true, q: query || undefined }),
    enabled: tab === "verified",
  });

  const allQ = useQuery({
    queryKey: ["all-shops", query],
    queryFn: () => getShops({ q: query || undefined }),
    enabled: tab === "all",
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => verifyShop(id, true),
    onSuccess: () => {
      toast.success("Do'kon tasdiqlandi ✅");
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectShop(id, reason),
    onSuccess: () => {
      toast.success("Ariza rad etildi");
      setRejectId(null);
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
      void qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const featuredMut = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => setShopFeatured(id, featured, 30),
    onSuccess: () => {
      toast.success("Featured yangilandi");
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
      void qc.invalidateQueries({ queryKey: ["all-shops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading =
    tab === "pending" ? pendingQ.isLoading :
    tab === "verified" ? verifiedQ.isLoading :
    allQ.isLoading;

  if (isLoading) return <PageLoader rows={5} />;

  const items =
    tab === "pending" ? (pendingQ.data?.items ?? []) :
    tab === "verified" ? (verifiedQ.data?.items ?? []) :
    (allQ.data?.items ?? []);

  const total =
    tab === "pending" ? (pendingQ.data?.count ?? 0) :
    tab === "verified" ? (verifiedQ.data?.total ?? 0) :
    (allQ.data?.total ?? 0);

  return (
    <div className="space-y-4">
      {/* Tabs + Stats */}
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const count =
            t.value === "pending" ? (pendingQ.data?.count ?? 0) :
            t.value === "verified" ? (verifiedQ.data?.total ?? 0) :
            (allQ.data?.total ?? 0);
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value as typeof tab)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition",
                tab === t.value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-secondary/60 text-muted-foreground hover:bg-secondary",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {tab === t.value && count > 0 && (
                <span className="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs font-bold">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search (for verified/all tabs) */}
      {tab !== "pending" && (
        <div className="admin-card">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
            }}
          >
            <Input
              placeholder="Do'kon nomi, telefon yoki slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
            {query && (
              <Button type="button" variant="ghost" onClick={() => { setSearch(""); setQuery(""); }}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </form>
        </div>
      )}

      {/* Pending info banner */}
      {tab === "pending" && items.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-300">
          <strong>{items.length} ta do&apos;kon</strong> moderatsiya kutmoqda. Har bir qatorni bosib to&apos;liq profil ko&apos;ring.
        </div>
      )}

      {/* Table */}
      <div className="admin-card overflow-x-auto">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-muted-foreground">
            {tab === "pending" ? "Kutilayotgan arizalar" : tab === "verified" ? "Tasdiqlangan do'konlar" : "Barcha do'konlar"} — {total} ta
          </h2>
        </div>
        {items.length === 0 ? (
          <EmptyState
            title={tab === "pending" ? "Kutilayotgan ariza yo'q 🎉" : "Do'kon topilmadi"}
            description={tab !== "pending" ? "Qidiruv so'zini o'zgartiring" : undefined}
          />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Do&apos;kon</th>
                <th>Egasi / Telefon</th>
                <th>Bozor / Joy</th>
                <th>Holat</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr
                  key={s.id}
                  className="cursor-pointer hover:bg-secondary/30"
                  onClick={() => setDetailId(s.id)}
                >
                  <td>
                    <div className="flex items-center gap-2.5">
                      {s.storefront_image_url || s.logo_url ? (
                        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-secondary">
                          <Image
                            src={resolveMediaUrl(s.storefront_image_url || s.logo_url)}
                            alt={s.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                          <Store className="h-4 w-4" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm">{s.name}</span>
                          {s.is_verified && <BadgeCheck className="h-3.5 w-3.5 text-emerald-400" />}
                          {s.is_featured && <Star className="h-3.5 w-3.5 text-amber-400" />}
                          {s.is_blocked && <Ban className="h-3.5 w-3.5 text-red-400" />}
                        </div>
                        {s.slug && <div className="text-xs text-muted-foreground">/{s.slug}</div>}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="text-sm">{s.owner_display_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{s.owner_phone ?? "—"}</div>
                  </td>
                  <td className="text-sm text-muted-foreground">
                    <div>{s.ipadrom_name ?? s.market_zone ?? "—"}</div>
                    {s.address_label && <div className="text-xs">{s.address_label}</div>}
                  </td>
                  <td>
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      s.verification_status === "approved" || s.is_verified
                        ? "bg-emerald-500/15 text-emerald-400"
                        : s.verification_status === "rejected"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                    )}>
                      {VERIFY_LABELS[s.verification_status ?? ""] ?? s.verification_status ?? "pending"}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {tab === "pending" ? (
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => approveMut.mutate(s.id)}
                          disabled={approveMut.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Tasdiqlash
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejectId(s.id)}>
                          <X className="h-3.5 w-3.5" />
                          Rad
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(s.id)}>
                          Ko&apos;rish
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => featuredMut.mutate({ id: s.id, featured: !s.is_featured })}
                          disabled={featuredMut.isPending}
                        >
                          {s.is_featured ? <Star className="h-3.5 w-3.5 text-amber-400" /> : <Star className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {rejectId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="admin-card w-full max-w-md space-y-4">
            <h3 className="font-semibold">Rad etish sababi</h3>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Sabab kiriting..."
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                onClick={() => rejectMut.mutate({ id: rejectId, reason })}
                disabled={rejectMut.isPending || !reason.trim()}
              >
                Rad etish
              </Button>
              <Button variant="ghost" onClick={() => setRejectId(null)}>
                Bekor
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Detail drawer */}
      {detailId ? (
        <ShopDetailDrawer
          shopId={detailId}
          tab={tab === "pending" ? "pending" : "verified"}
          onClose={() => setDetailId(null)}
          onApproved={() => setDetailId(null)}
        />
      ) : null}
    </div>
  );
}
