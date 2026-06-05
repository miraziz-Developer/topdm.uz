"use client";

import { ImagePlus, Loader2, Trash2, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { StoryAdjustEditor } from "@/components/story-adjust-editor";
import { Button } from "@/components/ui/button";
import {
  deleteMerchantStory,
  getMerchantMe,
  listMerchantStories,
  uploadMerchantStory,
  type MerchantStoryItem,
} from "@/lib/api";

const STORY_LIMIT = 3;
const STORY_TTL_HOURS = 24;
import { resolveMediaUrl } from "@/lib/media";

type ShopMeta = {
  floor?: string | null;
  section?: string | null;
  name?: string;
};

export function StoryUploadWidget() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [shop, setShop] = useState<ShopMeta | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [adjustSrc, setAdjustSrc] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeStories, setActiveStories] = useState<MerchantStoryItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clearPending = useCallback(() => {
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setAdjustSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const refreshStories = useCallback(async () => {
    try {
      const res = await listMerchantStories();
      setActiveStories(res.items ?? []);
    } catch {
      setActiveStories([]);
    }
  }, []);

  useEffect(() => {
    void refreshStories();
  }, [refreshStories]);

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

  const onSelectFile = useCallback(
    (file: File | null) => {
      setMessage(null);
      setError(null);
      if (!file) return;

      if (file.type.startsWith("video/")) {
        setError("Video tez orada. Hozir story uchun rasm (JPG, PNG) ishlating.");
        return;
      }
      if (!file.type.startsWith("image/")) {
        setError("Faqat rasm fayllari qabul qilinadi.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("Rasm 8 MB dan kichik bo'lishi kerak.");
        return;
      }

      clearPending();
      const url = URL.createObjectURL(file);
      setAdjustSrc(url);
    },
    [clearPending],
  );

  const onAdjustDone = useCallback(
    (file: File) => {
      setAdjustSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      const url = URL.createObjectURL(file);
      setPreview(url);
      setPendingFile(file);
    },
    [],
  );

  const onAdjustCancel = useCallback(() => {
    setAdjustSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onConfirmUpload = useCallback(async () => {
    if (!pendingFile || uploading) return;
    if (activeStories.length >= STORY_LIMIT) {
      setError(
        `Faol storylar limiti tugadi (maksimum ${STORY_LIMIT} ta). Avval eskisini o'chiring.`,
      );
      return;
    }
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await uploadMerchantStory(pendingFile);
      const active = (result as { active_count?: number }).active_count ?? activeStories.length + 1;
      setMessage(
        `Story yuborildi — ${result.item.level_context}. ${STORY_TTL_HOURS} soat davomida ko'rinadi (${active}/${STORY_LIMIT}).`,
      );
      void refreshStories();
      clearPending();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Yuklash muvaffaqiyatsiz.";
      if (msg.includes("story_limit") || msg.includes("limiti tugadi")) {
        setError(
          `Faol storylar limiti tugadi (maksimum ${STORY_LIMIT} ta). Yangisini qo'shish uchun eskisini o'chiring.`,
        );
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  }, [activeStories.length, pendingFile, uploading, refreshStories, clearPending]);

  const onDeleteStory = useCallback(
    async (storyId: string) => {
      if (deletingId) return;
      if (!window.confirm("Story o'chirilsinmi? Bosh sahifadan ham yo'qoladi.")) return;
      setDeletingId(storyId);
      setError(null);
      try {
        await deleteMerchantStory(storyId);
        setMessage("Story o'chirildi.");
        await refreshStories();
      } catch (err) {
        setError(err instanceof Error ? err.message : "O'chirib bo'lmadi.");
      } finally {
        setDeletingId(null);
      }
    },
    [deletingId, refreshStories],
  );

  const hasPending = Boolean(pendingFile && preview);

  if (adjustSrc) {
    return (
      <StoryAdjustEditor
        imageSrc={adjustSrc}
        onCancel={onAdjustCancel}
        onDone={onAdjustDone}
      />
    );
  }

  return (
    <section className="rounded-3xl border border-border-subtle bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Upload className="h-5 w-5 text-gold-500" />
        <h2 className="text-xl font-semibold text-text-100">Story Jo&apos;natish</h2>
      </div>
      <p className="mt-1 text-sm text-text-400">
        Rasmni 9:16 formatga joylashtiring — {STORY_TTL_HOURS} soat jonli (Instagram kabi). Maksimum{" "}
        <strong className="text-text-200">{STORY_LIMIT} ta</strong> faol story. Qavat:{" "}
        <span className="font-medium text-text-200">{levelLabel}</span>
      </p>
      {activeStories.length >= STORY_LIMIT ? (
        <p className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 ring-1 ring-amber-500/25">
          Limit to&apos;ldi ({activeStories.length}/{STORY_LIMIT}) — yangi story uchun eskisini o&apos;chiring.
        </p>
      ) : (
        <p className="mt-2 text-xs text-text-400">
          Faol storylar: {activeStories.length}/{STORY_LIMIT}
        </p>
      )}

      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onClick={() => {
          if (!uploading) inputRef.current?.click();
        }}
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
          if (!uploading) onSelectFile(event.dataTransfer.files?.[0] ?? null);
        }}
        className="mt-4 flex min-h-[11rem] cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border-subtle bg-canvas/60 px-4 py-6 text-center transition hover:border-gold-500/50 sm:min-h-[12rem]"
      >
        {preview ? (
          <div className="relative aspect-[9/16] w-full max-w-[10rem] overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-border-subtle">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Story preview" className="h-full w-full object-cover" />
          </div>
        ) : (
          <>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gold-500/15 text-gold-500">
              <ImagePlus className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-text-100">Rasmni tanlang — keyin joylashtirasiz</p>
            <p className="text-xs text-text-400">JPG, PNG, WebP · max 8 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(event) => onSelectFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!hasPending ? (
          <Button type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            Rasm tanlash
          </Button>
        ) : (
          <>
            <button
              type="button"
            disabled={uploading || activeStories.length >= STORY_LIMIT}
            onClick={() => void onConfirmUpload()}
              className="crm-btn-primary inline-flex h-11 items-center gap-2 px-6 disabled:opacity-50"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Yuklanmoqda…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Story yuklash
                </>
              )}
            </button>
            <Button
              type="button"
              variant="secondary"
              disabled={uploading}
              onClick={() => {
                if (preview) {
                  setAdjustSrc(preview);
                  setPreview(null);
                  setPendingFile(null);
                } else {
                  inputRef.current?.click();
                }
              }}
            >
              Qayta joylash
            </Button>
            <Button type="button" variant="ghost" disabled={uploading} onClick={clearPending}>
              <X className="mr-1 h-4 w-4" />
              Bekor
            </Button>
          </>
        )}
      </div>

      {hasPending && !uploading ? (
        <p className="mt-2 text-xs text-text-400">
          Preview mijozlar ko&apos;radigan 9:16 format. «Story yuklash» — bosh sahifaga chiqadi.
        </p>
      ) : null}

      {message ? <p className="mt-3 text-sm font-medium text-emerald-600">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red">{error}</p> : null}

      {activeStories.length > 0 ? (
        <div className="mt-6 border-t border-border-subtle pt-5">
          <p className="text-sm font-semibold text-text-100">Faol storylar</p>
          <ul className="mt-3 flex gap-3 overflow-x-auto pb-1">
            {activeStories.map((story) => (
              <li key={story.id} className="shrink-0">
                <div className="relative aspect-[9/16] h-28 overflow-hidden rounded-2xl border border-border-subtle bg-black">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveMediaUrl(story.image_url)}
                    alt={story.level_context}
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    disabled={deletingId === story.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      void onDeleteStory(story.id);
                    }}
                    className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition hover:bg-red-600 disabled:opacity-50"
                    aria-label="Storyni o'chirish"
                    title="O'chirish"
                  >
                    {deletingId === story.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
                <p className="mt-1 max-w-[4.5rem] truncate text-[10px] text-text-400">
                  {new Date(story.expires_at).toLocaleString("uz-UZ", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  gacha
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 text-xs text-text-400">
          Faol story yo&apos;q — yangi rasm yuklang, bosh sahifada ko&apos;rinadi.
        </p>
      )}
    </section>
  );
}
