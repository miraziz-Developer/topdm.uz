"use client";

import { BadgeCheck, Camera, Loader2, Send, User } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { InteractiveStarPicker, ProductRatingStars } from "@/components/product/product-rating-stars";
import { productReviewsShell } from "@/components/product/product-premium-ui";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getProductReviews, submitProductReview, type ProductReview, type ProductReviewSummary } from "@/lib/api";
import { resolveReviewAuthor } from "@/lib/review-author";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `+${digits.slice(0, 3)} ••• ${digits.slice(-2)}`;
}

function formatReviewDate(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );
  } catch {
    return "";
  }
}

function DistributionBars({ distribution, total }: { distribution: Record<string, number>; total: number }) {
  const rows = [5, 4, 3, 2, 1];
  return (
    <div className="flex flex-1 flex-col gap-1.5">
      {rows.map((star) => {
        const count = distribution[String(star)] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        return (
          <div key={star} className="flex items-center gap-2 text-[11px] text-ink-500">
            <span className="w-3 text-right font-medium">{star}</span>
            <StarMini filled />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-6 text-right tabular-nums">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

function StarMini({ filled }: { filled?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={cn("h-3 w-3", filled ? "fill-amber-400 text-amber-400" : "text-ink-200")}>
      <path d="M10 1.5l2.47 5.01 5.53.8-4 3.9.94 5.5L10 14.2l-4.94 2.6.94-5.5-4-3.9 5.53-.8L10 1.5z" />
    </svg>
  );
}

function ReviewCard({ review }: { review: ProductReview }) {
  const [lightbox, setLightbox] = useState<string | null>(null);
  return (
    <article className="rounded-2xl border border-black/[0.05] bg-[#fafaf9] p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-ink-900">{review.author_name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <ProductRatingStars rating={review.rating} size="sm" />
            {review.is_verified_purchase ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Tasdiqlangan xarid
              </span>
            ) : null}
          </div>
        </div>
        <time className="text-[11px] text-ink-400">{formatReviewDate(review.created_at)}</time>
      </div>
      {review.body ? <p className="mt-2.5 text-sm leading-relaxed text-ink-700">{review.body}</p> : null}
      {review.photo_urls.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.photo_urls.map((url) => {
            const src = resolveMediaUrl(url);
            return (
              <button
                key={url}
                type="button"
                onClick={() => setLightbox(src)}
                className="relative h-20 w-20 overflow-hidden rounded-xl border border-border-subtle bg-elevated"
              >
                <Image src={src} alt="Xaridor rasmi" fill className="object-cover" sizes="80px" unoptimized />
              </button>
            );
          })}
        </div>
      ) : null}
      {lightbox ? (
        <button
          type="button"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setLightbox(null)}
          aria-label="Yopish"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" className="max-h-[90vh] max-w-full rounded-lg object-contain" />
        </button>
      ) : null}
    </article>
  );
}

type ProductReviewsSectionProps = {
  productId: string;
  productName: string;
  initialSummary?: ProductReviewSummary;
};

export function ProductReviewsSection({ productId, productName, initialSummary }: ProductReviewsSectionProps) {
  const { push } = useToast();
  const authMeta = useAuthStore((s) => s.meta);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const profile = useUserStore((s) => s.profile);
  const refreshProfile = useUserStore((s) => s.refresh);
  const [summary, setSummary] = useState<ProductReviewSummary | null>(initialSummary ?? null);
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const authorCtx = useMemo(() => resolveReviewAuthor(profile, authMeta), [profile, authMeta]);

  useEffect(() => {
    if (showForm && isLoggedIn && !profile) {
      void refreshProfile();
    }
  }, [showForm, isLoggedIn, profile, refreshProfile]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getProductReviews(productId);
      setSummary({
        average_rating: data.average_rating,
        review_count: data.review_count,
        distribution: data.distribution,
      });
      setReviews(data.items);
    } catch {
      push("Sharhlarni yuklab bo'lmadi", "error");
    } finally {
      setLoading(false);
    }
  }, [productId, push]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      previews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previews]);

  const onPickPhotos = (files: FileList | null) => {
    if (!files?.length) return;
    const next = [...photos, ...Array.from(files)].slice(0, 4);
    setPhotos(next);
    previews.forEach((url) => URL.revokeObjectURL(url));
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  };

  const onSubmit = async () => {
    if (rating < 1) {
      push("Avval 1–5 yulduz baho bering", "error");
      return;
    }
    if (!authorCtx.canSubmit) {
      push("Sharh uchun avval profilga kiring yoki buyurtma bering", "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await submitProductReview(productId, {
        rating,
        body: body.trim() || undefined,
        author_name: authorCtx.authorName,
        customer_phone: authorCtx.phone ?? undefined,
      }, photos);
      setSummary(res.summary);
      setReviews((prev) => [res.review, ...prev]);
      setRating(0);
      setBody("");
      setPhotos([]);
      previews.forEach((url) => URL.revokeObjectURL(url));
      setPreviews([]);
      setShowForm(false);
      push("Rahmat! Sharhingiz qo'shildi", "success");
    } catch {
      push("Sharh yuborilmadi. Qayta urinib ko'ring", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const total = summary?.review_count ?? 0;
  const avg = summary?.average_rating ?? 0;
  const distribution = summary?.distribution ?? { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };

  const emptyState = !loading && total === 0;

  const summaryBlock = useMemo(
    () => (
      <div className="flex flex-col gap-5 rounded-2xl bg-gradient-to-br from-ink-900/[0.03] to-amber-50/40 p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="text-center sm:min-w-[130px] sm:text-left">
          <p className="text-4xl font-bold tabular-nums tracking-tight text-ink-900">
            {avg > 0 ? avg.toFixed(1) : "—"}
          </p>
          <ProductRatingStars rating={avg || 0} size="md" className="mt-1.5 justify-center sm:justify-start" />
          <p className="mt-1.5 text-xs font-medium text-ink-500">
            {total > 0 ? `${total} ta sharh · 5 yulduz` : "Birinchi baho qoldiring"}
          </p>
        </div>
        {total > 0 ? <DistributionBars distribution={distribution} total={total} /> : null}
      </div>
    ),
    [avg, total, distribution],
  );

  return (
    <section id="product-reviews" className="scroll-mt-28">
      <div className={cn(productReviewsShell, "space-y-6")}>
        <div className="flex flex-col gap-3 border-b border-black/[0.06] pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-ink-400">Xaridorlar fikri</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">Sharhlar va baholar</h2>
            <p className="mt-1 text-sm text-ink-500">{productName}</p>
          </div>
          <Button
            type="button"
            variant="brand"
            size="sm"
            className="shrink-0 rounded-xl"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Yopish" : "Sharh yozish"}
          </Button>
        </div>

        {summaryBlock}

      {showForm ? (
        <div className="rounded-2xl border border-black/[0.06] bg-[#fafaf9] p-4 sm:p-5">
          {authorCtx.canSubmit ? (
            <div className="mb-3 flex items-start gap-2 rounded-xl bg-elevated/60 px-3 py-2.5 text-sm text-ink-700">
              <User className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" aria-hidden />
              <div>
                <p>
                  Sharh nomidan: <span className="font-medium text-ink-900">{authorCtx.authorName}</span>
                </p>
                {authorCtx.phone ? (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Telefon: {maskPhone(authorCtx.phone)}
                    {authorCtx.source === "profile" ? " · profilingizdan" : " · buyurtmangizdan"}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-ink-500">
                    Profilga telefon qo&apos;shsangiz, xarid tasdiqlanadi
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mb-3 rounded-xl border border-amber-100 bg-amber-50/80 px-3 py-3 text-sm text-amber-900">
              <p className="font-medium">Avval profilingizni ulang</p>
              <p className="mt-1 text-xs text-amber-800/90">
                Ism va telefon avtomatik olinadi — qo&apos;lda kiritish shart emas.
              </p>
              <Link
                href="/profile"
                className="mt-2 inline-block text-xs font-semibold text-brand-700 underline-offset-2 hover:underline"
              >
                Profilga o&apos;tish →
              </Link>
            </div>
          )}
          <p className="mb-3 text-sm font-medium text-ink-800">Bahongiz</p>
          <InteractiveStarPicker value={rating} onChange={setRating} />
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-ink-600">Izoh</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-border-subtle px-3 py-2 text-sm outline-none focus:border-brand-400"
              placeholder="Mahsulot sizga qanday tushdi? O'lcham, rang, sifat..."
              maxLength={2000}
            />
          </label>
          <div className="mt-3">
            <p className="mb-2 text-sm text-ink-600">Tovar rasmini yuklang (4 tagacha)</p>
            <div className="flex flex-wrap items-center gap-2">
              {previews.map((src) => (
                <div key={src} className="relative h-16 w-16 overflow-hidden rounded-lg border border-border-subtle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </div>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-ink-300 px-3 py-2 text-sm text-ink-600 hover:bg-elevated">
                <Camera className="h-4 w-4" />
                Rasm tanlash
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="sr-only"
                  onChange={(e) => onPickPhotos(e.target.files)}
                />
              </label>
            </div>
          </div>
          <Button
            type="button"
            className="mt-4 w-full sm:w-auto"
            variant="brand"
            disabled={submitting || !authorCtx.canSubmit}
            leftIcon={submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            onClick={() => void onSubmit()}
          >
            Yuborish
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-ink-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Yuklanmoqda...
        </div>
      ) : emptyState ? (
        <p className="rounded-2xl border border-dashed border-ink-200/70 bg-white/50 px-4 py-8 text-center text-sm text-ink-500">
          Bu mahsulot uchun hali sharh yo&apos;q. Birinchi bo&apos;lib baho va rasm qoldiring.
        </p>
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
      </div>
    </section>
  );
}
