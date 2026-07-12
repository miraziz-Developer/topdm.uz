"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Store } from "lucide-react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { getPendingProducts, type PendingProductItem } from "@/lib/admin-api";

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

export default function ModerationPage() {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<PendingProductItem | null>(null);

  const q = useQuery({
    queryKey: ["pending-products", offset],
    queryFn: () => getPendingProducts({ offset }),
  });

  if (q.isLoading) return <PageLoader rows={6} />;

  const items = q.data?.items ?? [];
  const total = q.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="admin-card">
        <div className="flex items-center gap-2 mb-1">
          <Package className="h-5 w-5 text-primary" />
          <h2 className="text-base font-semibold">Pending mahsulotlar</h2>
          <span className="ml-auto text-sm text-muted-foreground">Jami: {total}</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Moderatsiya kutayotgan mahsulotlar. Har bir qatorni bosib tafsilotlarni ko&apos;ring.
        </p>
      </div>

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
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer hover:bg-secondary/30"
                  onClick={() => setSelected(item)}
                >
                  <td>
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="font-medium">{item.shop_name ?? item.shop_id.slice(0, 8)}</span>
                    </div>
                  </td>
                  <td>
                    <span className="admin-badge admin-badge-pending">{item.status}</span>
                  </td>
                  <td className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {item.moderation_reason ?? "—"}
                  </td>
                  <td className="text-sm text-muted-foreground">{formatDate(item.created_at)}</td>
                  <td>
                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected(item);
                      }}
                    >
                      Ko&apos;rish
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > 50 && (
        <div className="flex gap-2 justify-center">
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm bg-secondary/60 disabled:opacity-40"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 50))}
          >
            ← Oldingi
          </button>
          <span className="px-4 py-2 text-sm text-muted-foreground">
            {offset + 1}–{Math.min(offset + 50, total)} / {total}
          </span>
          <button
            type="button"
            className="rounded-lg px-4 py-2 text-sm bg-secondary/60 disabled:opacity-40"
            disabled={offset + 50 >= total}
            onClick={() => setOffset(offset + 50)}
          >
            Keyingi →
          </button>
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="admin-card space-y-3">
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
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs">{selected.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Do&apos;kon ID</dt>
              <dd className="font-mono text-xs">{selected.shop_id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Holat</dt>
              <dd>
                <span className="admin-badge admin-badge-pending">{selected.status}</span>
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
              <p className="text-sm font-medium mb-1">Vision atributlari</p>
              <pre className="rounded-lg bg-secondary/40 p-3 text-xs overflow-x-auto">
                {JSON.stringify(selected.vision_attributes, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
