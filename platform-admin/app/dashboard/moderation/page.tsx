"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Package, Store, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { Button } from "@/components/ui/button";
import { adminFetch, getPendingProducts, type PendingProductItem } from "@/lib/admin-api";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("uz-UZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Kutilmoqda", cls: "bg-amber-500/15 text-amber-400" },
  pending_ai: { label: "AI tekshiruvda", cls: "bg-blue-500/15 text-blue-400" },
  pending_manual: { label: "Moderator kutilmoqda", cls: "bg-amber-500/15 text-amber-400" },
  approved: { label: "Tasdiqlangan", cls: "bg-emerald-500/15 text-emerald-400" },
  rejected: { label: "Rad etilgan", cls: "bg-red-500/15 text-red-400" },
};

function approveProduct(id: string) {
  return adminFetch(`/admin/products/${id}/approve`, { method: "POST" });
}

function rejectProduct(id: string, reason: string) {
  return adminFetch(`/admin/products/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export default function ModerationPage() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PendingProductItem | null>(null);
  const [rejectReason, setRejectReason] = useState("Mahsulot talablarga mos emas.");

  const q = useQuery({
    queryKey: ["pending-products", offset],
    queryFn: () => getPendingProducts({ offset }),
  });

  const approveMut = useMutation({
    mutationFn: (id: string) => approveProduct(id),
    onSuccess: () => {
      toast.success("Mahsulot tasdiqlandi ✅");
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["pending-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectProduct(id, reason),
    onSuccess: () => {
      toast.success("Mahsulot rad etildi");
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["pending-products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <PageLoader rows={6} />;

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="admin-card flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
          <Package className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-base font-semibold">Mahsulot moderatsiyasi</h2>
          <p className="text-sm text-muted-foreground">
            {total > 0 ? (
              <><strong className="text-amber-400">{total} ta</strong> mahsulot moderatsiya kutmoqda</>
            ) : (
              "Barcha mahsulotlar moderatsiyadan o'tgan 🎉"
            )}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="admin-card overflow-x-auto">
        {items.length === 0 ? (
          <EmptyState
            title="Pending mahsulot yo'q 🎉"
            description="Barcha mahsulotlar moderatsiyadan o'tgan"
          />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Do&apos;kon</th>
                <th>Holat</th>
                <th>Sabab</th>
                <th>Sana</th>
                <th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const statusInfo = STATUS_LABELS[item.status] ?? { label: item.status, cls: "bg-secondary text-muted-foreground" };
                return (
                  <tr
                    key={item.id}
                    className={cn(
                      "cursor-pointer hover:bg-secondary/30",
                      selected?.id === item.id && "bg-secondary/40"
                    )}
                    onClick={() => setSelected(selected?.id === item.id ? null : item)}
                  >
                    <td>
                      <div className="flex items-center gap-2">
                        <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-medium">{item.shop_name ?? item.shop_id.slice(0, 8)}</span>
                      </div>
                    </td>
                    <td>
                      <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", statusInfo.cls)}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {item.moderation_reason ?? "—"}
                    </td>
                    <td className="text-sm text-muted-foreground">{formatDate(item.created_at)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => approveMut.mutate(item.id)}
                          disabled={approveMut.isPending}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => {
                            setSelected(item);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex gap-2 justify-center">
          <Button
            variant="secondary"
            size="sm"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            ← Oldingi
          </Button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + 50, total)} / {total}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={offset + 50 >= total}
            onClick={() => setOffset(offset + 50)}
          >
            Keyingi →
          </Button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="admin-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Mahsulot tafsilotlari</h3>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              ✕ Yopish
            </button>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs">{selected.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Do&apos;kon</dt>
              <dd className="font-medium">{selected.shop_name ?? selected.shop_id.slice(0, 8)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Holat</dt>
              <dd>
                <span className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  STATUS_LABELS[selected.status]?.cls ?? "bg-secondary text-muted-foreground"
                )}>
                  {STATUS_LABELS[selected.status]?.label ?? selected.status}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sabab</dt>
              <dd>{selected.moderation_reason ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sana</dt>
              <dd>{formatDate(selected.created_at)}</dd>
            </div>
          </dl>

          {selected.vision_attributes && Object.keys(selected.vision_attributes).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">AI Vision atributlari</p>
              <pre className="rounded-lg bg-secondary/40 p-3 text-xs overflow-x-auto max-h-48">
                {JSON.stringify(selected.vision_attributes, null, 2)}
              </pre>
            </div>
          )}

          {/* Reject form */}
          <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
            <p className="text-sm font-medium">Rad etish sababi</p>
            <textarea
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm min-h-[80px]"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Sabab kiriting..."
            />
            <div className="flex gap-2">
              <Button
                variant="success"
                size="sm"
                onClick={() => approveMut.mutate(selected.id)}
                disabled={approveMut.isPending}
              >
                <Check className="h-4 w-4" />
                Tasdiqlash
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => rejectMut.mutate({ id: selected.id, reason: rejectReason })}
                disabled={rejectMut.isPending || !rejectReason.trim()}
              >
                <X className="h-4 w-4" />
                Rad etish
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
