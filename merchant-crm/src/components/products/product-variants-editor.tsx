"use client";

import { ImagePlus, Package, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  DEFAULT_SIZES,
  skuKey,
  totalSkuStock,
  type VariantCatalog,
  type VariantColorRow,
} from "@/lib/product-variants";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

type Props = {
  catalog: VariantCatalog;
  onChange: (next: VariantCatalog) => void;
};

function VariantImageThumb({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveMediaUrl(src) || src;
  if (!resolved || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-canvas text-text-400">
        <Package className="h-5 w-5 opacity-40" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={resolved}
      alt={alt}
      className="h-full w-full object-cover"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function FilePreviewThumb({ file }: { file: File }) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  if (!preview) {
    return <div className="h-full w-full animate-pulse bg-canvas" />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={preview} alt="" className="h-full w-full object-cover" />
  );
}

export function ProductVariantsEditor({ catalog, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const activeColorRef = useRef<string | null>(null);

  const setCatalog = (patch: Partial<VariantCatalog>) => {
    onChange({ ...catalog, ...patch });
  };

  const addSize = (size: string) => {
    const t = size.trim().toUpperCase();
    if (!t || catalog.allSizes.includes(t)) return;
    setCatalog({ allSizes: [...catalog.allSizes, t] });
  };

  const removeSize = (size: string) => {
    const allSizes = catalog.allSizes.filter((s) => s !== size);
    const colors = catalog.colors.map((c) => ({
      ...c,
      sizes: c.sizes.filter((s) => s !== size),
    }));
    const skuStock = { ...catalog.skuStock };
    for (const c of colors) {
      delete skuStock[skuKey(c.name, size)];
    }
    setCatalog({ allSizes, colors, skuStock });
  };

  const addColor = () => {
    const row: VariantColorRow = {
      id: crypto.randomUUID(),
      name: "",
      sizes: [],
      imageUrls: [],
      imageFiles: [],
    };
    setCatalog({ colors: [...catalog.colors, row] });
  };

  const updateColor = (id: string, patch: Partial<VariantColorRow>) => {
    setCatalog({
      colors: catalog.colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const removeColor = (id: string) => {
    const removed = catalog.colors.find((c) => c.id === id);
    const colors = catalog.colors.filter((c) => c.id !== id);
    const skuStock = { ...catalog.skuStock };
    if (removed) {
      for (const size of removed.sizes) {
        delete skuStock[skuKey(removed.name, size)];
      }
    }
    setCatalog({ colors, skuStock });
  };

  const toggleColorSize = (colorId: string, size: string) => {
    const color = catalog.colors.find((c) => c.id === colorId);
    if (!color) return;
    const has = color.sizes.includes(size);
    const skuStock = { ...catalog.skuStock };
    const key = skuKey(color.name, size);
    if (has) {
      delete skuStock[key];
    } else if (skuStock[key] == null) {
      skuStock[key] = 0;
    }
    onChange({
      ...catalog,
      colors: catalog.colors.map((c) =>
        c.id === colorId
          ? { ...c, sizes: has ? c.sizes.filter((s) => s !== size) : [...c.sizes, size] }
          : c,
      ),
      skuStock,
    });
  };

  const renameColor = (colorId: string, nextName: string) => {
    const color = catalog.colors.find((c) => c.id === colorId);
    if (!color) return;
    const prev = color.name.trim();
    const next = nextName;
    if (!prev || prev === next.trim()) {
      updateColor(colorId, { name: next });
      return;
    }
    const skuStock = { ...catalog.skuStock };
    for (const size of color.sizes) {
      const oldKey = skuKey(prev, size);
      const newKey = skuKey(next, size);
      if (oldKey in skuStock) {
        skuStock[newKey] = skuStock[oldKey];
        delete skuStock[oldKey];
      }
    }
    onChange({
      ...catalog,
      colors: catalog.colors.map((c) => (c.id === colorId ? { ...c, name: next } : c)),
      skuStock,
    });
  };

  const setSku = (color: string, size: string, stock: number) => {
    const key = skuKey(color, size);
    setCatalog({
      skuStock: { ...catalog.skuStock, [key]: Math.max(0, stock) },
    });
  };

  const pickImages = (colorId: string) => {
    activeColorRef.current = colorId;
    fileRef.current?.click();
  };

  const onFilesPicked = (files: FileList | null) => {
    const colorId = activeColorRef.current;
    if (!colorId || !files?.length) return;
    const color = catalog.colors.find((c) => c.id === colorId);
    if (!color) return;
    updateColor(colorId, {
      imageFiles: [...color.imageFiles, ...Array.from(files)],
    });
  };

  const stockTotal = totalSkuStock(catalog);
  const matrixRows = catalog.colors.filter((c) => c.name.trim() && c.sizes.length > 0);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-canvas/80 p-3 ring-1 ring-border-subtle">
        <p className="text-sm font-semibold text-text-100">Razmerlar ro&apos;yxati</p>
        <p className="mt-0.5 text-xs text-text-400">Har rang uchun alohida razmerlar tanlanadi</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {catalog.allSizes.map((size) => (
            <span
              key={size}
              className="inline-flex items-center gap-1 rounded-lg bg-surface px-2.5 py-1 text-xs font-semibold text-text-100 ring-1 ring-border-subtle"
            >
              {size}
              <button type="button" onClick={() => removeSize(size)} className="text-text-400 hover:text-red">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {DEFAULT_SIZES.filter((s) => !catalog.allSizes.includes(s)).slice(0, 6).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addSize(s)}
              className="rounded-lg border border-dashed border-border-subtle px-2 py-1 text-[11px] text-text-400 hover:border-electric-500/50"
            >
              + {s}
            </button>
          ))}
          <form
            className="flex gap-1"
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("customSize") as HTMLInputElement);
              addSize(input.value);
              input.value = "";
            }}
          >
            <input
              name="customSize"
              placeholder="Boshqa"
              className="h-7 w-16 rounded-lg border border-border-subtle bg-surface px-2 text-[11px]"
            />
          </form>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-text-100">Ranglar va rasmlar</p>
          <button type="button" onClick={addColor} className="text-xs font-semibold text-electric-600">
            + Rang qo&apos;shish
          </button>
        </div>

        {catalog.colors.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border-subtle py-6 text-center text-xs text-text-400">
            Rang qo&apos;shing — har rang uchun alohida rasmlar
          </p>
        ) : (
          catalog.colors.map((color) => (
            <div key={color.id} className="rounded-xl border border-border-subtle bg-canvas/50 p-3">
              <div className="flex gap-2">
                <input
                  value={color.name}
                  onChange={(e) => renameColor(color.id, e.target.value)}
                  placeholder="Rang nomi (Qora, Oq...)"
                  className="h-10 flex-1 rounded-lg border border-border-subtle bg-surface px-3 text-sm"
                />
                <button type="button" onClick={() => removeColor(color.id)} className="rounded-lg p-2 text-text-400 hover:text-red">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {catalog.allSizes.map((size) => {
                  const on = color.sizes.includes(size);
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={!color.name.trim()}
                      onClick={() => toggleColorSize(color.id, size)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold transition",
                        on
                          ? "border-electric-500 bg-electric-500/10 text-electric-700"
                          : "border-border-subtle text-text-400 hover:bg-surface",
                        !color.name.trim() && "opacity-40",
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {color.imageUrls.map((url, i) => (
                  <div
                    key={`${url}-${i}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-border-subtle"
                  >
                    <VariantImageThumb src={url} alt={color.name || "Rang rasmi"} />
                    <button
                      type="button"
                      className="absolute right-0.5 top-0.5 rounded bg-black/55 p-0.5 text-white"
                      onClick={() =>
                        updateColor(color.id, {
                          imageUrls: color.imageUrls.filter((_, idx) => idx !== i),
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {color.imageFiles.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-canvas ring-1 ring-electric-500/30"
                  >
                    <FilePreviewThumb file={file} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => pickImages(color.id)}
                  className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border-subtle bg-surface text-text-400 hover:border-electric-500/50"
                >
                  <ImagePlus className="h-5 w-5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {matrixRows.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <p className="border-b border-border-subtle bg-canvas/80 px-3 py-2 text-xs font-semibold text-text-100">
            Ombor (dona) · jami {stockTotal}
          </p>
          <table className="w-full min-w-[320px] text-left text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-400">
                <th className="px-3 py-2">Rang</th>
                {catalog.allSizes.map((size) => (
                  <th key={size} className="px-2 py-2 text-center">
                    {size}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((color) => (
                <tr key={color.id} className="border-b border-border-subtle/80 last:border-0">
                  <td className="px-3 py-2 font-medium text-text-100">{color.name}</td>
                  {catalog.allSizes.map((size) => {
                    const enabled = color.sizes.includes(size);
                    const key = skuKey(color.name, size);
                    return (
                      <td key={size} className="px-1 py-1 text-center">
                        {enabled ? (
                          <input
                            type="number"
                            min={0}
                            value={catalog.skuStock[key] ?? 0}
                            onChange={(e) => setSku(color.name, size, Number(e.target.value))}
                            className="h-8 w-14 rounded-lg border border-border-subtle bg-surface text-center"
                          />
                        ) : (
                          <span className="text-text-400/40">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onFilesPicked(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
