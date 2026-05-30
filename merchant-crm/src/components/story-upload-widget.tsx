"use client";

import { ImagePlus, Loader2, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { getMerchantMe, uploadMerchantStory } from "@/lib/api";

type ShopMeta = {
  floor?: string | null;
  section?: string | null;
  name?: string;
};

export function StoryUploadWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shop, setShop] = useState<ShopMeta | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getMerchantMe()
      .then((response) => {
        if (cancelled) return;
        setShop(response.shop);
      })
      .catch(() => {
        if (!cancelled) setError("Do'kon ma'lumotlarini yuklab bo'lmadi.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const levelLabel = [shop?.floor, shop?.section].filter(Boolean).join(" · ") || "Ippodrom";

  const onPickFile = useCallback((file: File | null) => {
    setMessage(null);
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Faqat rasm fayllari qabul qilinadi.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Rasm 8 MB dan kichik bo'lishi kerak.");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    void (async () => {
      setUploading(true);
      try {
        const result = await uploadMerchantStory(file);
        setMessage(`Story yuborildi — ${result.item.level_context}. 24 soat davomida ko'rinadi.`);
        setPreview((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return null;
        });
        if (inputRef.current) inputRef.current.value = "";
      } catch (err) {
        setError(err instanceof Error ? err.message : "Yuklash muvaffaqiyatsiz.");
      } finally {
        setUploading(false);
      }
    })();
  }, []);

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-gold-500" />
        <h2 className="text-xl font-semibold text-text-100">Story Jo&apos;natish</h2>
      </div>
      <p className="mt-1 text-sm text-text-400">
        Yangi kiyim rasmini yuklang — qavat va rasta avtomatik biriktiriladi:{" "}
        <span className="font-medium text-text-200">{levelLabel}</span>
      </p>

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          event.currentTarget.classList.add("ring-2", "ring-gold-500/40");
        }}
        onDragLeave={(event) => {
          event.currentTarget.classList.remove("ring-2", "ring-gold-500/40");
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.currentTarget.classList.remove("ring-2", "ring-gold-500/40");
          onPickFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className="mt-4 flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-canvas/60 px-4 py-6 text-center transition hover:border-gold-500/50 sm:min-h-[12rem]"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Tanlangan story" className="max-h-40 rounded-xl object-contain" />
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-500">
              {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : <ImagePlus className="h-6 w-6" />}
            </div>
            <p className="text-sm font-medium text-text-100">Rasmni sudrab tashlang yoki bosing</p>
            <p className="text-xs text-text-400">Telefon / kompyuter — JPG, PNG, WebP (max 8 MB)</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => onPickFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? "Yuklanmoqda…" : "Rasm tanlash"}
        </Button>
      </div>

      {message ? <p className="mt-3 text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}
    </section>
  );
}
