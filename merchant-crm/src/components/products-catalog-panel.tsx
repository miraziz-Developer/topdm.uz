"use client";

import {
  Package,
  Pencil,
  Percent,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmFilterChip } from "@/components/crm/filter-chip";
import { ProductEditorSheet } from "@/components/products/product-editor-sheet";
import { ProductStatusToggle } from "@/components/products/product-status-toggle";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  bulkDiscountProducts,
  deleteMerchantProduct,
  getMerchantProducts,
  setProductFeatured,
  updateMerchantProduct,
  type MerchantProduct,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { shortId } from "@/lib/short-id";
import { cn, formatPrice } from "@/lib/utils";

type FilterKey = "all" | "live" | "archive" | "out_of_stock" | "low_stock";

const LOW_STOCK_MAX = 3;

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Barchasi" },
  { key: "live", label: "Faol" },
  { key: "archive", label: "Arxiv" },
  { key: "out_of_stock", label: "Tugagan" },
  { key: "low_stock", label: "Kam qolgan" },
];

function matchesFilter(p: MerchantProduct, filter: FilterKey): boolean {
  const live = p.is_available !== false;
  const stock = Number(p.stock_count ?? 0);
  switch (filter) {
    case "live":
      return live;
    case "archive":
      return !live;
    case "out_of_stock":
      return live && stock <= 0;
    case "low_stock":
      return live && stock > 0 && stock <= LOW_STOCK_MAX;
    default:
      return true;
  }
}

function RowActions({
  product,
  onEdit,
  onDelete,
  onFeatured,
}: {
  product: MerchantProduct;
  onEdit: () => void;
  onDelete: () => void;
  onFeatured: () => void;
}) {
  return (
    <ActionMenu
      triggerClassName="rounded-lg p-2 text-text-400 hover:bg-canvas hover:text-text-100"
      items={[
        {
          key: "edit",
          label: "Tahrirlash",
          icon: <Pencil className="h-3.5 w-3.5" />,
          onSelect: onEdit,
        },
        {
          key: "featured",
          label: product.is_featured ? "Asosiydan olib tashlash" : "Asosiy sahifaga",
          icon: <Sparkles className="h-3.5 w-3.5" />,
          onSelect: onFeatured,
        },
        {
          key: "delete",
          label: "O'chirish",
          icon: <Trash2 className="h-3.5 w-3.5" />,
          tone: "danger",
          onSelect: onDelete,
        },
      ]}
    />
  );
}

export function ProductsCatalogPanel() {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [discountPct, setDiscountPct] = useState("10");
  const [discountBusy, setDiscountBusy] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingProduct, setEditingProduct] = useState<MerchantProduct | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const reload = async () => {
    const catalog = await getMerchantProducts(true);
    setProducts(catalog.items);
    setSelected(new Set());
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch {
        if (!cancelled) toast.error("Ro'yxatni yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const counts = useMemo(
    () => ({
      all: products.length,
      live: products.filter((p) => p.is_available !== false).length,
      archive: products.filter((p) => p.is_available === false).length,
      out_of_stock: products.filter((p) => p.is_available !== false && Number(p.stock_count ?? 0) <= 0).length,
      low_stock: products.filter(
        (p) =>
          p.is_available !== false &&
          Number(p.stock_count ?? 0) > 0 &&
          Number(p.stock_count ?? 0) <= LOW_STOCK_MAX,
      ).length,
    }),
    [products],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (!matchesFilter(p, filter)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        shortId(p.id).toLowerCase().includes(q)
      );
    });
  }, [products, filter, query]);

  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visible.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreate = () => {
    setEditorMode("create");
    setEditingProduct(null);
    setEditorOpen(true);
  };

  const openEdit = (product: MerchantProduct) => {
    setEditorMode("edit");
    setEditingProduct(product);
    setEditorOpen(true);
  };

  const toggleAvailability = async (product: MerchantProduct, next: boolean) => {
    setTogglingId(product.id);
    try {
      const res = await updateMerchantProduct(product.id, { is_available: next });
      setProducts((cur) => cur.map((p) => (p.id === product.id ? { ...p, ...res.item } : p)));
      toast.success(next ? "Mahsulot faol" : "Arxivga olindi");
    } catch {
      toast.error("Holatni o'zgartirib bo'lmadi");
    } finally {
      setTogglingId(null);
    }
  };

  const toggleFeatured = async (product: MerchantProduct) => {
    try {
      const response = await setProductFeatured(product.id, !product.is_featured);
      setProducts((current) =>
        current.map((item) => (item.id === product.id ? { ...item, is_featured: response.is_featured } : item)),
      );
      toast.success(response.is_featured ? "Asosiy sahifada" : "Asosiydan olindi");
    } catch {
      toast.error("Saqlab bo'lmadi");
    }
  };

  const removeProduct = async (product: MerchantProduct) => {
    if (!window.confirm(`"${product.name}" ni o'chirasizmi?`)) return;
    try {
      await deleteMerchantProduct(product.id);
      toast.success("O'chirildi");
      await reload();
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const applyBulkDiscount = async () => {
    const pct = Number(discountPct);
    if (!pct || pct < 1 || pct > 90) {
      toast.error("Foiz 1–90");
      return;
    }
    setDiscountBusy(true);
    try {
      const ids = selected.size > 0 ? Array.from(selected) : undefined;
      const res = await bulkDiscountProducts(pct, ids);
      await reload();
      toast.success(`${res.updated} ta mahsulotga ${res.percent_off}%`);
    } catch {
      toast.error("Chegirma qo'llanmadi");
    } finally {
      setDiscountBusy(false);
    }
  };

  if (loading) {
    return <div className="skeleton h-96 rounded-3xl" />;
  }

  const hasCatalog = products.length > 0;

  return (
    <div className="space-y-0">
      <div className="crm-surface-card">
        <div className="border-b border-border-subtle/80 bg-gradient-to-br from-surface via-surface to-canvas/40 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Jami</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-text-100">{counts.all}</p>
            </div>
            <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Faol</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-700">{counts.live}</p>
            </div>
            <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Kam qolgan</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-amber-700">{counts.low_stock}</p>
            </div>
            <div className="rounded-2xl bg-surface px-3.5 py-3 ring-1 ring-border-subtle/90">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-text-400">Tugagan</p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-text-100">{counts.out_of_stock}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nom, kategoriya yoki ID"
                className="h-12 w-full rounded-2xl border-0 bg-canvas/90 pl-11 pr-4 text-sm font-medium text-text-100 shadow-inner ring-1 ring-border-subtle/80 placeholder:font-normal placeholder:text-text-400 focus:ring-2 focus:ring-electric-500/25"
              />
            </div>
            <button
              type="button"
              onClick={openCreate}
              className="crm-btn-primary inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl px-6"
            >
              <Plus className="h-4 w-4" />
              Qo&apos;shish
            </button>
          </div>

          {selected.size > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-electric-500/[0.06] px-3 py-2.5 ring-1 ring-electric-500/15">
              <span className="text-xs font-semibold text-electric-600">{selected.size} ta tanlandi</span>
              <Input
                type="number"
                min={1}
                max={90}
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="h-9 w-14 rounded-lg border-0 bg-surface text-center text-sm ring-1 ring-border-subtle"
                aria-label="Chegirma foizi"
              />
              <span className="text-xs font-medium text-text-400">%</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={discountBusy}
                onClick={() => void applyBulkDiscount()}
              >
                <Percent className="mr-1 h-3.5 w-3.5" />
                Chegirma
              </Button>
            </div>
          ) : null}

          <div className="mt-4 flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map((tab) => (
              <CrmFilterChip
                key={tab.key}
                active={filter === tab.key}
                label={tab.label}
                count={counts[tab.key]}
                onClick={() => setFilter(tab.key)}
              />
            ))}
          </div>
        </div>

        {!visible.length ? (
          <div className="px-6 py-16 text-center sm:py-20">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-electric-500/12 to-transparent ring-1 ring-electric-500/15">
              <Package className="h-7 w-7 text-electric-500" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-lg font-bold tracking-tight text-text-100">
              {hasCatalog ? "Bu filtrda mahsulot yo'q" : "Katalog hali bo'sh"}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-400">
              {hasCatalog
                ? "Boshqa filtrni tanlang yoki qidiruvni tozalang."
                : "Telegram botga mahsulot rasmini yuboring — AI to'ldiradi, yoki qo'lda qo'shing."}
            </p>
            {!hasCatalog ? (
              <button type="button" onClick={openCreate} className="crm-btn-primary mt-6 inline-flex h-11 items-center gap-2 px-6">
                <Plus className="h-4 w-4" />
                Birinchi mahsulot
              </button>
            ) : null}
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border-subtle text-xs font-medium text-text-400">
                    <th className="w-12 px-4 py-3.5 sm:px-5">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border-subtle"
                        aria-label="Hammasini tanlash"
                      />
                    </th>
                    <th className="px-2 py-3.5 font-medium">Mahsulot</th>
                    <th className="px-4 py-3.5 font-medium">Ko&apos;rishlar</th>
                    <th className="px-4 py-3.5 font-medium">Narx</th>
                    <th className="px-4 py-3.5 font-medium">Ombor</th>
                    <th className="px-4 py-3.5 font-medium">Holat</th>
                    <th className="w-12 px-4 py-3.5 sm:px-5" />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((product) => {
                    const thumb = resolveMediaUrl(product.images?.[0]);
                    const live = product.is_available !== false;
                    const stock = Number(product.stock_count ?? 0);
                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border-subtle/80 transition hover:bg-canvas/50 last:border-b-0"
                      >
                        <td className="px-4 py-4 sm:px-5">
                          <input
                            type="checkbox"
                            checked={selected.has(product.id)}
                            onChange={() => toggleSelect(product.id)}
                            className="h-4 w-4 rounded border-border-subtle"
                          />
                        </td>
                        <td className="px-2 py-4">
                          <button
                            type="button"
                            onClick={() => openEdit(product)}
                            className="flex items-center gap-3 text-left"
                          >
                            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-canvas ring-1 ring-border-subtle">
                              {thumb ? (
                                <Image src={thumb} alt="" fill className="object-cover" sizes="44px" unoptimized />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center">
                                  <Package className="h-5 w-5 text-text-400/40" />
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-text-100">{product.name}</p>
                              <p className="mt-0.5 text-xs text-text-400">
                                ID: {shortId(product.id)}
                                {product.is_featured ? (
                                  <span className="ml-2 text-electric-600">· Asosiyda</span>
                                ) : null}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="px-4 py-4 tabular-nums text-text-100">{product.view_count ?? 0}</td>
                        <td className="px-4 py-4 font-medium tabular-nums text-text-100">{formatPrice(product.price)}</td>
                        <td className="px-4 py-4">
                          <span
                            className={cn(
                              "tabular-nums",
                              stock <= 0 ? "text-red" : stock <= LOW_STOCK_MAX ? "text-amber-700" : "text-text-100",
                            )}
                          >
                            {stock}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <ProductStatusToggle
                              checked={live}
                              disabled={togglingId === product.id}
                              onChange={(next) => void toggleAvailability(product, next)}
                            />
                            <span className="text-xs text-text-400">{live ? "Faol" : "Arxiv"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4 sm:px-5">
                          <RowActions
                            product={product}
                            onEdit={() => openEdit(product)}
                            onDelete={() => void removeProduct(product)}
                            onFeatured={() => void toggleFeatured(product)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile list */}
            <ul className="space-y-3 p-4 md:hidden">
              {visible.map((product) => {
                const thumb = resolveMediaUrl(product.images?.[0]);
                const live = product.is_available !== false;
                const stock = Number(product.stock_count ?? 0);
                return (
                  <li
                    key={product.id}
                    className="flex items-center gap-3 rounded-2xl bg-canvas/50 p-3.5 ring-1 ring-border-subtle/90"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(product.id)}
                      onChange={() => toggleSelect(product.id)}
                      className="h-4 w-4 shrink-0 rounded border-border-subtle"
                    />
                    <button
                      type="button"
                      onClick={() => openEdit(product)}
                      className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface ring-1 ring-border-subtle"
                    >
                      {thumb ? (
                        <Image src={thumb} alt="" fill className="object-cover" sizes="56px" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-5 w-5 text-text-400/40" />
                        </div>
                      )}
                    </button>
                    <button type="button" onClick={() => openEdit(product)} className="min-w-0 flex-1 text-left">
                      <p className="truncate font-bold tracking-tight text-text-100">{product.name}</p>
                      <p className="mt-0.5 text-sm font-semibold tabular-nums text-text-100">{formatPrice(product.price)}</p>
                      <p className="mt-0.5 text-xs text-text-400">
                        {shortId(product.id)} · Ombor {stock}
                        {product.is_featured ? " · Asosiyda" : ""}
                      </p>
                    </button>
                    <ProductStatusToggle
                      checked={live}
                      disabled={togglingId === product.id}
                      onChange={(next) => void toggleAvailability(product, next)}
                    />
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <ProductEditorSheet
        open={editorOpen}
        mode={editorMode}
        product={editingProduct}
        onClose={() => setEditorOpen(false)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
