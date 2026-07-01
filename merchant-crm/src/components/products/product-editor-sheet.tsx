"use client";

import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { ProductVariantsEditor } from "@/components/products/product-variants-editor";
import { WholesalePackEditor } from "@/components/products/wholesale-pack-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createMerchantProduct,
  getMerchantMe,
  getMerchantProduct,
  type MerchantProduct,
  updateMerchantProduct,
  uploadMerchantProductImages,
} from "@/lib/api";
import {
  catalogToPayload,
  emptyVariantCatalog,
  parseVariantCatalogFromAttributes,
  parseVariantCatalogFromProduct,
  totalSkuStock,
  type VariantCatalog,
} from "@/lib/product-variants";
import { customerSalePriceUzs, formatUzs } from "@/lib/product-pricing";
import {
  defaultWholesaleForShop,
  parseWholesaleFromProduct,
  validateWholesaleFields,
  wholesaleToCreateForm,
  type WholesaleProductFields,
} from "@/lib/wholesale-pack";
import { cn } from "@/lib/utils";

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  product?: MerchantProduct | null;
  onClose: () => void;
  onSaved: () => void;
};

function collectCreateFiles(catalog: VariantCatalog): { files: File[]; imageMeta: (string | null)[] } {
  const files: File[] = [];
  const imageMeta: (string | null)[] = [];
  for (const color of catalog.colors) {
    for (const file of color.imageFiles) {
      files.push(file);
      imageMeta.push(color.name.trim() || null);
    }
  }
  return { files, imageMeta };
}

function collectPendingUploads(catalog: VariantCatalog) {
  const items: Array<{ file: File; color?: string | null }> = [];
  for (const color of catalog.colors) {
    for (const file of color.imageFiles) {
      items.push({ file, color: color.name.trim() || null });
    }
  }
  return items;
}

export function ProductEditorSheet({ open, mode, product, onClose, onSaved }: Props) {
  const coverRef = useRef<HTMLInputElement>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [stock, setStock] = useState("5");
  const [featured, setFeatured] = useState(false);
  const [available, setAvailable] = useState(true);
  const [catalog, setCatalog] = useState<VariantCatalog>(emptyVariantCatalog);
  const [busy, setBusy] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [shopType, setShopType] = useState<string | null>(null);
  const [wholesale, setWholesale] = useState<WholesaleProductFields>(() => defaultWholesaleForShop(null));

  useEffect(() => {
    if (!open) return;
    void getMerchantMe()
      .then((res) => setShopType(res.shop.shop_type ?? "chakana"))
      .catch(() => setShopType("chakana"));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && product?.id) {
      setLoadingDetail(true);
      getMerchantProduct(product.id)
        .then((res) => {
          const item = res.item;
          setName(item.name);
          setPrice(String(item.price));
          setDescription(item.description || "");
          setStock(String(item.stock_count ?? 0));
          setFeatured(item.is_featured);
          setAvailable(item.is_available !== false);
          const parsed = item.variant_catalog
            ? parseVariantCatalogFromProduct(item.variant_catalog)
            : parseVariantCatalogFromAttributes(item.attributes);
          setCatalog(parsed);
          setWholesale(
            parseWholesaleFromProduct({
              sale_type: (item as { sale_type?: string }).sale_type,
              pricing_unit: (item as { pricing_unit?: string }).pricing_unit,
              min_order_quantity: (item as { min_order_quantity?: number }).min_order_quantity,
              units_per_pack: (item as { units_per_pack?: number | null }).units_per_pack,
              attributes: item.attributes as Record<string, unknown> | undefined,
            }),
          );
          setCoverFile(null);
          setCoverPreview(null);
        })
        .catch(() => {
          setName(product.name);
          setPrice(String(product.price));
          setDescription(product.description || "");
          setStock(String(product.stock_count ?? 0));
          setFeatured(product.is_featured);
          setAvailable(product.is_available !== false);
          setCatalog(parseVariantCatalogFromAttributes(product.attributes));
        })
        .finally(() => setLoadingDetail(false));
    } else {
      setName("");
      setPrice("");
      setDescription("");
      setStock("5");
      setFeatured(false);
      setAvailable(true);
      setCatalog(emptyVariantCatalog());
      setWholesale(defaultWholesaleForShop(shopType));
      setCoverFile(null);
      setCoverPreview(null);
    }
  }, [open, mode, product, shopType]);

  useEffect(() => {
    if (!coverFile) return;
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  if (!open) return null;

  const hasVariants = catalog.colors.some((c) => c.name.trim());
  const skuTotal = totalSkuStock(catalog);
  const useSkuStock = skuTotal > 0;

  const save = async () => {
    const priceNum = Number(price.replace(/\s/g, ""));
    if (!name.trim() || name.trim().length < 2) {
      toast.error("Mahsulot nomini kiriting");
      return;
    }
    if (!priceNum || priceNum < 1) {
      toast.error("Narxni kiriting");
      return;
    }
    const wholesaleError = validateWholesaleFields(wholesale);
    if (wholesaleError) {
      toast.error(wholesaleError);
      return;
    }

    setBusy(true);
    try {
      const variantPayload = hasVariants
        ? catalogToPayload(catalog, useSkuStock ? undefined : Number(stock) || 0)
        : undefined;

      if (hasVariants && useSkuStock && skuTotal <= 0) {
        toast.error("Variantlar uchun ombor (dona) kiriting");
        setBusy(false);
        return;
      }

      if (mode === "create") {
        const { files, imageMeta } = collectCreateFiles(catalog);
        if (coverFile) {
          files.unshift(coverFile);
          imageMeta.unshift(null);
        }
        if (!files.length) {
          toast.error("Kamida bitta rasm yuklang (asosiy yoki rang rasmi)");
          setBusy(false);
          return;
        }
        await createMerchantProduct({
          files,
          imageMeta,
          name: name.trim(),
          price: priceNum,
          description: description.trim() || undefined,
          stock_count: useSkuStock ? skuTotal : Number(stock) || 5,
          is_featured: featured,
          variantCatalog: variantPayload,
          wholesale: wholesaleToCreateForm(wholesale),
        });
        toast.success("Mahsulot qo'shildi");
      } else if (product) {
        await updateMerchantProduct(product.id, {
          name: name.trim(),
          price: priceNum,
          description: description.trim() || null,
          stock_count: useSkuStock ? skuTotal : Number(stock) || 0,
          is_featured: featured,
          is_available: available,
          variant_catalog: variantPayload,
        });
        const uploads = collectPendingUploads(catalog);
        if (uploads.length) {
          await uploadMerchantProductImages(product.id, uploads);
        }
        toast.success("O'zgarishlar saqlandi");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Saqlab bo'lmadi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-label="Yopish" />
      <aside className="relative flex h-full max-h-[100dvh] w-full max-w-2xl flex-col bg-surface shadow-2xl ring-1 ring-border-subtle">
        <header className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-electric-600">
              {mode === "create" ? "Yangi mahsulot" : "Tahrirlash"}
            </p>
            <h2 className="text-lg font-semibold text-text-100">
              {mode === "create" ? "Katalogga qo'shish" : product?.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-text-400 hover:bg-canvas hover:text-text-100"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-5 py-5 pb-8">
          {loadingDetail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-electric-500" />
            </div>
          ) : (
            <>
              <Input label="Nomi" value={name} onChange={(e) => setName(e.target.value)} placeholder="Masalan: Charm sumka" />
              <Input
                label="Sizning narxingiz (so'm) — bazaviy"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="numeric"
                placeholder="245000"
              />
              {Number(price.replace(/\s/g, "")) > 0 ? (
                <p className="rounded-xl bg-electric-500/10 px-3 py-2 text-xs text-text-300">
                  Mijoz saytda ko&apos;radi:{" "}
                  <span className="font-bold text-electric-600">
                    {formatUzs(customerSalePriceUzs(Number(price.replace(/\s/g, ""))))}
                  </span>{" "}
                  <span className="text-text-400">(+15% platforma ustamasi)</span>
                </p>
              ) : null}

              {shopType && shopType.toLowerCase() !== "chakana" ? (
                <WholesalePackEditor shopType={shopType} value={wholesale} onChange={setWholesale} />
              ) : null}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text-300">Tavsif</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Mijoz uchun qisqa izoh"
                  className="w-full resize-none rounded-xl border border-border-subtle bg-canvas px-3 py-2.5 text-sm text-text-100 placeholder:text-text-400 focus:border-electric-500 focus:outline-none focus:ring-2 focus:ring-electric-500/20"
                />
              </div>

              {catalog.colors.length === 0 ? (
                <div>
                  <p className="mb-2 text-sm font-medium text-text-300">Asosiy rasm</p>
                  <button
                    type="button"
                    onClick={() => coverRef.current?.click()}
                    className={cn(
                      "relative flex h-36 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border-subtle bg-canvas",
                      coverPreview && "border-solid",
                    )}
                  >
                    {coverPreview ? (
                      <Image src={coverPreview} alt="" fill className="object-cover" unoptimized />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-text-400">
                        <ImagePlus className="h-7 w-7" />
                        <span className="text-sm">Rasm tanlang</span>
                      </div>
                    )}
                  </button>
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              ) : null}

              <ProductVariantsEditor catalog={catalog} onChange={setCatalog} />

              {!useSkuStock ? (
                <Input
                  label="Omborda (dona) — umumiy"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  inputMode="numeric"
                  type="number"
                  min={0}
                />
              ) : (
                <p className="text-xs text-text-400">
                  Ombor rang/razmer jadvalida hisoblanadi (jami {skuTotal} dona)
                </p>
              )}

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-canvas px-4 py-3 ring-1 ring-border-subtle">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="h-4 w-4 rounded text-electric-500"
                />
                <span className="flex items-center gap-2 text-sm font-medium text-text-100">
                  <Sparkles className="h-4 w-4 text-electric-500" />
                  Asosiy sahifada ko&apos;rsatish
                </span>
              </label>

              {mode === "edit" ? (
                <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-canvas px-4 py-3 ring-1 ring-border-subtle">
                  <input
                    type="checkbox"
                    checked={available}
                    onChange={(e) => setAvailable(e.target.checked)}
                    className="h-4 w-4 rounded text-electric-500"
                  />
                  <span className="text-sm font-medium text-text-100">Do&apos;konda ko&apos;rinadi (faol)</span>
                </label>
              ) : null}
            </>
          )}
        </div>

        <footer className="shrink-0 flex gap-2 border-t border-border-subtle bg-surface p-5">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            Bekor
          </Button>
          <Button
            type="button"
            className="flex-1 border-0 bg-electric-500 text-white hover:bg-electric-600"
            disabled={busy || loadingDetail}
            onClick={() => void save()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === "create" ? "Qo'shish" : "Saqlash"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}
