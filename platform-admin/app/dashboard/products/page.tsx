"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Edit2,
  Eye,
  Package,
  Search,
  Star,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import Image from "next/image";
import {
  AdminProductDetail,
  AdminProductItem,
  deleteAdminProduct,
  getAdminProduct,
  getAdminProducts,
  getShops,
  ShopItem,
  updateAdminProduct,
} from "@/src/lib/admin-api";

const PAGE_SIZE = 50;

function fmt(n: number) {
  return new Intl.NumberFormat("uz-UZ").format(n);
}

// ─── Detail Panel ────────────────────────────────────────────────────────────
function ProductDetailPanel({
  product,
  onClose,
  onUpdated,
  onDeleted,
}: {
  product: AdminProductDetail;
  onClose: () => void;
  onUpdated: (p: AdminProductDetail) => void;
  onDeleted: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description ?? "");
  const [price, setPrice] = useState(String(product.price));
  const [stock, setStock] = useState(String(product.stock_count));
  const [isAvailable, setIsAvailable] = useState(product.is_available);
  const [isFeatured, setIsFeatured] = useState(product.is_featured);

  const [imgIdx, setImgIdx] = useState(0);
  const images = product.images ?? [];

  async function handleSave() {
    setSaving(true);
    setErr(null);
    try {
      const updated = await updateAdminProduct(product.id, {
        name: name.trim(),
        description: description.trim() || null,
        price: parseFloat(price),
        stock_count: parseInt(stock),
        is_available: isAvailable,
        is_featured: isFeatured,
      });
      onUpdated({ ...product, ...updated });
      setEditing(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAdminProduct(product.id);
      onDeleted(product.id);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "O'chirishda xato");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  async function toggleAvailable() {
    try {
      const updated = await updateAdminProduct(product.id, { is_available: !isAvailable });
      setIsAvailable(updated.is_available);
      onUpdated({ ...product, is_available: updated.is_available });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Xato");
    }
  }

  async function toggleFeatured() {
    try {
      const updated = await updateAdminProduct(product.id, { is_featured: !isFeatured });
      setIsFeatured(updated.is_featured);
      onUpdated({ ...product, is_featured: updated.is_featured });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Xato");
    }
  }

  const attrs = product.attributes ?? {};
  const hashtags: string[] = Array.isArray(attrs.hashtags) ? (attrs.hashtags as string[]) : [];

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10 sticky top-0 bg-[#1a1f2e] z-10">
        <h2 className="text-sm font-semibold text-white truncate max-w-[200px]">{product.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={18} />
        </button>
      </div>

      {/* Image gallery */}
      {images.length > 0 && (
        <div className="relative bg-black/30 flex items-center justify-center" style={{ height: 220 }}>
          <Image
            src={images[imgIdx]}
            alt={product.name}
            fill
            className="object-contain"
            unoptimized
          />
          {images.length > 1 && (
            <>
              <button
                onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 bg-black/50 rounded-full p-1 text-white"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                className="absolute right-2 bg-black/50 rounded-full p-1 text-white"
              >
                <ChevronRight size={16} />
              </button>
              <div className="absolute bottom-2 text-xs text-white/70 bg-black/40 px-2 py-0.5 rounded-full">
                {imgIdx + 1}/{images.length}
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-4 space-y-4 flex-1">
        {err && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-3 text-red-300 text-xs">
            {err}
          </div>
        )}

        {/* Quick toggles */}
        <div className="flex gap-2">
          <button
            onClick={toggleAvailable}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              isAvailable
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30"
                : "bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
            }`}
          >
            {isAvailable ? <CheckCircle size={13} /> : <XCircle size={13} />}
            {isAvailable ? "Mavjud" : "Mavjud emas"}
          </button>
          <button
            onClick={toggleFeatured}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors ${
              isFeatured
                ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30"
                : "bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10"
            }`}
          >
            <Star size={13} />
            {isFeatured ? "Featured" : "Featured emas"}
          </button>
        </div>

        {/* Info */}
        {!editing ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Nomi</p>
              <p className="text-sm text-white font-medium">{product.name}</p>
            </div>
            {product.description && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Tavsif</p>
                <p className="text-xs text-gray-300 leading-relaxed">{product.description}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Narx</p>
                <p className="text-sm text-white font-semibold">{fmt(product.price)} so'm</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Stok</p>
                <p className="text-sm text-white">{product.stock_count} dona</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Ko'rishlar</p>
                <p className="text-sm text-white">{fmt(product.view_count)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Leadlar</p>
                <p className="text-sm text-white">{fmt(product.lead_count)}</p>
              </div>
            </div>
            {product.shop_name && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Do'kon</p>
                <p className="text-sm text-blue-400">{product.shop_name}</p>
              </div>
            )}
            {product.category_name && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Kategoriya</p>
                <p className="text-sm text-gray-300">{product.category_name}</p>
              </div>
            )}
            {hashtags.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Hashtaglar</p>
                <div className="flex flex-wrap gap-1">
                  {hashtags.map((t) => (
                    <span key={t} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => setEditing(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 rounded-lg text-sm font-medium transition-colors"
            >
              <Edit2 size={14} /> Tahrirlash
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Nomi</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tavsif</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Narx (so'm)</label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Stok</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? "Saqlanmoqda..." : "Saqlash"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium transition-colors"
              >
                Bekor
              </button>
            </div>
          </div>
        )}

        {/* Delete */}
        <div className="border-t border-white/10 pt-4">
          {!confirmDelete ? (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-sm font-medium transition-colors"
            >
              <Trash2 size={14} /> O'chirish
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-red-300 text-center">Rostdan ham o'chirasizmi?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium"
                >
                  {deleting ? "..." : "Ha, o'chir"}
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-sm font-medium"
                >
                  Bekor
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function ProductsPage() {
  const [items, setItems] = useState<AdminProductItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [shopFilter, setShopFilter] = useState("");
  const [availFilter, setAvailFilter] = useState<"" | "true" | "false">("");
  const [offset, setOffset] = useState(0);

  const [shops, setShops] = useState<ShopItem[]>([]);
  const [selected, setSelected] = useState<AdminProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load shops for filter dropdown
  useEffect(() => {
    getShops({ limit: 200 } as Parameters<typeof getShops>[0])
      .then((r) => setShops(r.items))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const opts: Parameters<typeof getAdminProducts>[0] = { offset, limit: PAGE_SIZE };
      if (q.trim()) opts.q = q.trim();
      if (shopFilter) opts.shop_id = shopFilter;
      if (availFilter !== "") opts.is_available = availFilter === "true";
      const data = await getAdminProducts(opts);
      setItems(data.items);
      setTotal(data.total);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Xato");
    } finally {
      setLoading(false);
    }
  }, [q, shopFilter, availFilter, offset]);

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(load, 300);
    return () => {
      if (searchRef.current) clearTimeout(searchRef.current);
    };
  }, [load]);

  async function openDetail(id: string) {
    setDetailLoading(true);
    try {
      const detail = await getAdminProduct(id);
      setSelected(detail);
    } catch {
      // ignore
    } finally {
      setDetailLoading(false);
    }
  }

  function handleUpdated(updated: AdminProductDetail) {
    setSelected(updated);
    setItems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
  }

  function handleDeleted(id: string) {
    setSelected(null);
    setItems((prev) => prev.filter((p) => p.id !== id));
    setTotal((t) => t - 1);
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      {/* Left: list */}
      <div className={`flex flex-col flex-1 min-w-0 overflow-hidden ${selected ? "hidden lg:flex" : "flex"}`}>
        {/* Filters */}
        <div className="p-4 border-b border-white/10 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setOffset(0); }}
                placeholder="Mahsulot nomini qidiring..."
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="text-xs text-gray-400 whitespace-nowrap">
              {total} ta
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={shopFilter}
              onChange={(e) => { setShopFilter(e.target.value); setOffset(0); }}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Barcha do'konlar</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <select
              value={availFilter}
              onChange={(e) => { setAvailFilter(e.target.value as "" | "true" | "false"); setOffset(0); }}
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Barchasi</option>
              <option value="true">Mavjud</option>
              <option value="false">Mavjud emas</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              Yuklanmoqda...
            </div>
          ) : err ? (
            <div className="flex items-center justify-center h-40 gap-2 text-red-400 text-sm">
              <AlertTriangle size={16} /> {err}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-500">
              <Package size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Mahsulot topilmadi</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#1a1f2e] z-10">
                <tr className="border-b border-white/10">
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium w-12">Rasm</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium">Nomi</th>
                  <th className="text-left px-4 py-3 text-xs text-gray-400 font-medium hidden md:table-cell">Do'kon</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium">Narx</th>
                  <th className="text-right px-4 py-3 text-xs text-gray-400 font-medium hidden sm:table-cell">Stok</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium">Holat</th>
                  <th className="text-center px-4 py-3 text-xs text-gray-400 font-medium w-10"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => openDetail(p.id)}
                    className={`border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors ${
                      selected?.id === p.id ? "bg-blue-500/10" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      {p.images?.[0] ? (
                        <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/5">
                          <Image src={p.images[0]} alt={p.name} fill className="object-cover" unoptimized />
                        </div>
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                          <Package size={14} className="text-gray-500" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.is_featured && <Star size={11} className="text-yellow-400 flex-shrink-0" />}
                        <span className="text-white font-medium truncate max-w-[160px]">{p.name}</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <Eye size={10} /> {fmt(p.view_count)}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-xs text-gray-400 truncate max-w-[120px] block">{p.shop_name ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-white text-xs font-medium">{fmt(p.price)}</span>
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className="text-xs text-gray-300">{p.stock_count}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.is_available
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {p.is_available ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {detailLoading && selected?.id === p.id ? (
                        <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto" />
                      ) : (
                        <ChevronRight size={14} className="text-gray-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <button
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              disabled={offset === 0}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 rounded-lg text-xs transition-colors"
            >
              <ChevronLeft size={13} /> Oldingi
            </button>
            <span className="text-xs text-gray-400">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setOffset(offset + PAGE_SIZE)}
              disabled={offset + PAGE_SIZE >= total}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-gray-300 rounded-lg text-xs transition-colors"
            >
              Keyingi <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-full lg:w-96 border-l border-white/10 bg-[#1a1f2e] flex-shrink-0 overflow-hidden flex flex-col">
          <ProductDetailPanel
            key={selected.id}
            product={selected}
            onClose={() => setSelected(null)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        </div>
      )}
    </div>
  );
}
