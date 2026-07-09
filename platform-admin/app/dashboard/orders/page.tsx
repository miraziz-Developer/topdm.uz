"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useState } from "react";

import { EmptyState } from "@/components/admin-empty-state";
import { PageLoader } from "@/components/admin-page-loader";
import { StatusBadge } from "@/components/admin-status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getOrder, getOrders, type OrderItem } from "@/lib/admin-api";
import { cn, formatDate, formatUzs } from "@/lib/utils";

const STATUSES = [
  { value: "", label: "Barchasi" },
  { value: "pending", label: "Kutilmoqda" },
  { value: "confirmed", label: "Tasdiqlangan" },
  { value: "delivered", label: "Yetkazilgan" },
  { value: "cancelled", label: "Bekor" },
];

const PAGE = 50;

function OrderDrawer({ order, onClose }: { order: OrderItem; onClose: () => void }) {
  const detailQ = useQuery({ queryKey: ["order", order.id], queryFn: () => getOrder(order.id) });
  const d = detailQ.data;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 p-4" onClick={onClose}>
      <div
        className="admin-card h-full w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Buyurtma tafsiloti</h3>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Yopish
          </Button>
        </div>
        {detailQ.isLoading ? (
          <p className="text-muted-foreground">Yuklanmoqda...</p>
        ) : d ? (
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs">{d.id}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Holat</dt>
              <dd>
                <StatusBadge status={d.status} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mahsulot</dt>
              <dd>{d.product_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Do&apos;kon</dt>
              <dd>{d.shop_name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Mijoz</dt>
              <dd>{d.customer_phone}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">To&apos;lov</dt>
              <dd className="uppercase">{d.payment_method ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Yetkazish</dt>
              <dd>{d.fulfillment_type ?? "—"}</dd>
            </div>
            {d.delivery_address ? (
              <div>
                <dt className="text-muted-foreground">Manzil</dt>
                <dd>{d.delivery_address}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Summa</dt>
              <dd className="text-lg font-bold text-primary">{formatUzs(d.total_uzs)}</dd>
            </div>
            {d.note ? (
              <div>
                <dt className="text-muted-foreground">Izoh</dt>
                <dd>{d.note}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-muted-foreground">Yaratilgan</dt>
              <dd>{formatDate(d.created_at)}</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<OrderItem | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", status, query, offset],
    queryFn: () => getOrders({ status: status || undefined, q: query || undefined, offset }),
  });

  if (isLoading && !data) return <PageLoader rows={6} />;

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-4">
      <div className="admin-card flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => {
                setStatus(s.value);
                setOffset(0);
              }}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                status === s.value ? "bg-primary text-primary-foreground" : "bg-secondary/60 text-muted-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <form
          className="ml-auto flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(search);
            setOffset(0);
          }}
        >
          <Input
            className="h-9 w-48"
            placeholder="Telefon yoki ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Button type="submit" size="sm" variant="secondary">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </div>

      <div className="admin-card overflow-x-auto">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Buyurtmalar ({total})</h2>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {offset + 1}–{offset + items.length} / {total}
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={offset + PAGE >= total}
              onClick={() => setOffset(offset + PAGE)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {items.length === 0 ? (
          <EmptyState title="Buyurtma topilmadi" description="Filtr yoki qidiruvni o'zgartiring" />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mijoz</th>
                <th>Do&apos;kon</th>
                <th>Holat</th>
                <th>Summa</th>
                <th>To&apos;lov</th>
                <th>Vaqt</th>
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-secondary/30" onClick={() => setSelected(o)}>
                  <td>{o.customer_phone ?? "—"}</td>
                  <td>{o.shop_name ?? "—"}</td>
                  <td>
                    <StatusBadge status={o.status} />
                  </td>
                  <td className="font-semibold">{formatUzs(o.total_uzs)}</td>
                  <td className="uppercase text-xs">{o.payment_method ?? "—"}</td>
                  <td className="text-muted-foreground">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected ? <OrderDrawer order={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}
