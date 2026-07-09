"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Search, Star, X } from "lucide-react";
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

export default function ShopsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "verified">("pending");
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

  const approveMut = useMutation({
    mutationFn: (id: string) => verifyShop(id, true),
    onSuccess: () => {
      toast.success("Do'kon tasdiqlandi");
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectShop(id, reason),
    onSuccess: () => {
      toast.success("Ariza rad etildi");
      setRejectId(null);
      void qc.invalidateQueries({ queryKey: ["pending-shops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const featuredMut = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => setShopFeatured(id, featured, 30),
    onSuccess: () => {
      toast.success("Featured yangilandi");
      void qc.invalidateQueries({ queryKey: ["verified-shops"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isLoading = tab === "pending" ? pendingQ.isLoading : verifiedQ.isLoading;
  if (isLoading) return <PageLoader rows={5} />;

  const items = tab === "pending" ? (pendingQ.data?.items ?? []) : (verifiedQ.data?.items ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("pending")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            tab === "pending" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
          )}
        >
          Kutilayotgan arizalar
        </button>
        <button
          type="button"
          onClick={() => setTab("verified")}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            tab === "verified" ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
          )}
        >
          Tasdiqlangan do&apos;konlar
        </button>
      </div>

      {tab === "verified" ? (
        <div className="admin-card">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQuery(search);
            }}
          >
            <Input placeholder="Do'kon nomi yoki telefon" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="admin-card">
          <p className="text-sm text-muted-foreground">
            Qatorni bosing — to&apos;liq profil ochiladi. Tasdiqlash yoki rad etish shu yerdan ham mumkin.
          </p>
        </div>
      )}

      <div className="admin-card overflow-x-auto">
        {items.length === 0 ? (
          <EmptyState title={tab === "pending" ? "Kutilayotgan ariza yo'q 🎉" : "Do'kon topilmadi"} />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Do&apos;kon</th>
                <th>Telefon</th>
                <th>Bozor / joy</th>
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
                    <div className="flex items-center gap-2">
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
                      ) : null}
                      <span className="font-medium">{s.name}</span>
                      {s.is_featured ? <Star className="h-3.5 w-3.5 text-amber-400" /> : null}
                    </div>
                  </td>
                  <td>{s.owner_phone ?? "—"}</td>
                  <td className="text-sm text-muted-foreground">
                    {s.ipadrom_name ?? s.market_zone ?? "—"}
                    {s.address_label ? ` · ${s.address_label}` : ""}
                  </td>
                  <td>
                    <span className="admin-badge admin-badge-pending">
                      {VERIFY_LABELS[s.verification_status ?? ""] ?? s.verification_status ?? "pending"}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {tab === "pending" ? (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="success" onClick={() => approveMut.mutate(s.id)}>
                          <Check className="h-3.5 w-3.5" /> Tasdiqlash
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setRejectId(s.id)}>
                          <X className="h-3.5 w-3.5" /> Rad
                        </Button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setDetailId(s.id)}>
                          Ko&apos;rish
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => featuredMut.mutate({ id: s.id, featured: !s.is_featured })}
                        >
                          {s.is_featured ? "Featured −" : "Featured"}
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

      {rejectId ? (
        <div className="admin-card space-y-3">
          <h3 className="font-semibold">Rad etish sababi</h3>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="danger" onClick={() => rejectMut.mutate({ id: rejectId, reason })}>
              Rad etish
            </Button>
            <Button variant="ghost" onClick={() => setRejectId(null)}>
              Bekor
            </Button>
          </div>
        </div>
      ) : null}

      {detailId ? (
        <ShopDetailDrawer
          shopId={detailId}
          tab={tab}
          onClose={() => setDetailId(null)}
          onApproved={(shop: ShopItem) => {
            setDetailId(null);
          }}
        />
      ) : null}
    </div>
  );
}
