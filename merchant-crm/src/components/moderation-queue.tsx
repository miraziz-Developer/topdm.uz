"use client";

import { Check, ImageIcon, Pencil, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  editPendingProduct,
  listPendingProducts,
  publishPendingProduct,
  rejectPendingProduct,
  type PendingProductItem,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn, formatPrice } from "@/lib/utils";

function pendingName(item: PendingProductItem) {
  const attrs = item.vision_attributes || {};
  return String(attrs.product_name || attrs.category || "Nomsiz mahsulot");
}

function pendingPrice(item: PendingProductItem) {
  const attrs = item.vision_attributes || {};
  return attrs.price_uzs != null ? Number(attrs.price_uzs) : null;
}

export function ModerationQueue() {
  const [items, setItems] = useState<PendingProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listPendingProducts("pending");
      setItems(res.items);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = (item: PendingProductItem) => {
    setEditingId(item.id);
    const attrs = item.vision_attributes || {};
    setDraftName(String(attrs.product_name || attrs.category || ""));
    setDraftPrice(attrs.price_uzs != null ? String(attrs.price_uzs) : "");
    setDraftDescription(String(attrs.description || ""));
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    try {
      await editPendingProduct(id, {
        name: draftName.trim() || undefined,
        price_uzs: draftPrice ? Number(draftPrice) : undefined,
        description: draftDescription.trim() || undefined,
      });
      toast.success("O'zgartirish saqlandi");
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setSavingId(null);
    }
  };

  const approve = async (id: string) => {
    if (publishingId) return;
    const item = items.find((i) => i.id === id);
    const attrs = item?.vision_attributes || {};
    const name =
      editingId === id && draftName.trim()
        ? draftName.trim()
        : String(attrs.product_name || attrs.category || "Mahsulot");
    const price = Number(editingId === id && draftPrice ? draftPrice : attrs.price_uzs || 0);
    setPublishingId(id);
    try {
      const res = await publishPendingProduct(id, {
        name,
        price_uzs: price,
        description: draftDescription.trim() || undefined,
      });
      toast.success(`«${res.product_name}» do'konda chiqdi`);
      setEditingId(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chop etib bo'lmadi");
    } finally {
      setPublishingId(null);
    }
  };

  const reject = async (id: string) => {
    if (rejectingId || publishingId) return;
    setRejectingId(id);
    try {
      const reason =
        window.prompt("Rad etish sababi (ixtiyoriy):", "Moderatsiya talablariga mos emas") ||
        "Moderatsiya talablariga mos emas";
      await rejectPendingProduct(id, { reason });
      toast.success("Rad etildi");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Rad etib bo'lmadi");
    } finally {
      setRejectingId(null);
    }
  };

  if (loading) {
    return <div className="skeleton h-72 rounded-3xl" />;
  }

  const busy = Boolean(publishingId || rejectingId);

  return (
    <div className="space-y-4">
      <div className="crm-surface-card p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-text-400">
          Telegram botga yuborgan <strong className="font-semibold text-text-100">rasmlar</strong> shu yerda
          ko&apos;rinadi. Nom va narxni tekshiring, keyin{" "}
          <strong className="font-semibold text-text-100">do&apos;konda chiqarish</strong>ni bosing.
        </p>
      </div>

      {!items.length ? (
        <div className="crm-surface-card py-16 text-center">
          <ImageIcon className="mx-auto h-10 w-10 text-text-400/50" />
          <p className="mt-3 font-medium text-text-100">Tasdiqlash uchun yangi rasm yo&apos;q</p>
          <p className="mt-1 text-sm text-text-400">Botga mahsulot rasmini yuboring</p>
        </div>
      ) : (
        <div className="crm-surface-card overflow-hidden">
          <div className="border-b border-border-subtle bg-canvas/50 px-4 py-2.5 sm:px-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-400">
              Kutmoqda · {items.length} ta
            </p>
          </div>

          {items.map((item) => {
            const attrs = item.vision_attributes || {};
            const isEditing = editingId === item.id;
            const isPublishing = publishingId === item.id;
            const thumb = resolveMediaUrl(
              String(attrs.image_url || attrs.preview_url || attrs.thumbnail_url || ""),
            );
            const price = pendingPrice(item);

            return (
              <article
                key={item.id}
                className="border-b border-border-subtle/80 px-4 py-4 last:border-b-0 sm:px-5"
              >
                <div className="flex gap-3 sm:gap-4">
                  <div className="mt-1 w-1 shrink-0 self-stretch min-h-[5rem] rounded-full bg-amber-400" aria-hidden />

                  <div className="flex min-w-0 flex-1 gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-canvas ring-1 ring-border-subtle">
                      {thumb ? (
                        <Image src={thumb} alt="" fill className="object-cover" sizes="80px" unoptimized />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-400/50">
                          <ImageIcon className="h-7 w-7" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                        Tekshirish kerak
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold text-text-100">{pendingName(item)}</h3>
                      <p className="mt-1 text-sm text-text-400">
                        {price != null ? formatPrice(price) : "Narx ko'rsatilmagan"}
                        {attrs.color ? (
                          <>
                            <span className="mx-1.5 text-border-subtle">·</span>
                            Rang: {String(attrs.color)}
                          </>
                        ) : null}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy && !isEditing}
                          onClick={() => startEdit(item)}
                        >
                          <Pencil className="mr-1.5 h-3.5 w-3.5" />
                          Nom / narx
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="border-0 bg-electric-500 text-white hover:bg-electric-600"
                          isLoading={isPublishing}
                          disabled={busy && !isPublishing}
                          onClick={() => void approve(item.id)}
                        >
                          <Check className="mr-1.5 h-3.5 w-3.5" />
                          Do&apos;konda chiqarish
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          isLoading={rejectingId === item.id}
                          disabled={busy && rejectingId !== item.id}
                          onClick={() => void reject(item.id)}
                          className="text-text-400"
                        >
                          <X className="mr-1.5 h-3.5 w-3.5" />
                          Rad etish
                        </Button>
                      </div>

                      {isEditing ? (
                        <div className={cn("mt-4 grid gap-2 rounded-xl bg-canvas/80 p-3 sm:grid-cols-2")}>
                          <Input
                            label="Mahsulot nomi"
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            placeholder="Masalan: Ko'ylak"
                          />
                          <Input
                            label="Narx (so'm)"
                            value={draftPrice}
                            onChange={(e) => setDraftPrice(e.target.value)}
                            inputMode="numeric"
                            placeholder="890000"
                          />
                          <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-sm font-medium text-text-300">Tavsif</label>
                            <textarea
                              value={draftDescription}
                              onChange={(e) => setDraftDescription(e.target.value)}
                              rows={2}
                              className="w-full resize-none rounded-xl border border-border-subtle bg-canvas px-3 py-2 text-sm text-text-100"
                            />
                          </div>
                          <Button
                            type="button"
                            className="sm:col-span-2"
                            size="sm"
                            variant="secondary"
                            isLoading={savingId === item.id}
                            onClick={() => void saveEdit(item.id)}
                          >
                            Saqlash
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
