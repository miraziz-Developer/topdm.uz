"use client";

import { Check, Filter, Package, Search, Star, X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  getCrmReviews,
  getMerchantProducts,
  moderateCrmReview,
  type CrmReviewCounts,
  type CrmReviewRow,
  type MerchantProduct,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { shortId } from "@/lib/short-id";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "all", label: "Barchasi" },
  { id: "pending_moderation", label: "Kutilmoqda" },
  { id: "approved", label: "Tasdiqlangan" },
  { id: "rejected", label: "Rad etilgan" },
] as const;

type StatusTab = (typeof STATUS_TABS)[number]["id"];

const STAR_OPTIONS = [
  { value: "", label: "Barcha yulduzlar" },
  { value: "5", label: "5 yulduz" },
  { value: "4", label: "4+ yulduz" },
  { value: "3", label: "3+ yulduz" },
  { value: "2", label: "2+ yulduz" },
  { value: "1", label: "1 yulduz" },
] as const;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  pending_moderation: { label: "Kutilmoqda", className: "bg-amber-500/12 text-amber-800" },
  approved: { label: "Tasdiqlangan", className: "bg-emerald-500/12 text-emerald-800" },
  rejected: { label: "Rad etilgan", className: "bg-red/10 text-red" },
};

function formatReviewDate(iso?: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("uz-UZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-3.5 w-3.5",
            i < rating ? "fill-amber-400 text-amber-400" : "text-text-400/50",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-semibold tabular-nums text-text-300">{rating}/5</span>
    </div>
  );
}

export function ReviewsModerationPanel() {
  const [status, setStatus] = useState<StatusTab>("all");
  const [items, setItems] = useState<CrmReviewRow[]>([]);
  const [counts, setCounts] = useState<CrmReviewCounts>({
    all: 0,
    pending_moderation: 0,
    approved: 0,
    rejected: 0,
  });
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const [productId, setProductId] = useState("");
  const [starFilter, setStarFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  useEffect(() => {
    void getMerchantProducts(true)
      .then((res) => setProducts(res.items))
      .catch(() => undefined);
  }, []);

  const queryParams = useMemo(() => {
    const params: Parameters<typeof getCrmReviews>[0] = {
      status,
      product_id: productId || undefined,
      q: search.trim() || undefined,
      date_from: dateFrom || undefined,
      date_to: dateTo || undefined,
      verified_only: verifiedOnly,
    };
    if (starFilter === "5") params.rating = 5;
    else if (starFilter) params.rating_min = Number(starFilter);
    return params;
  }, [status, productId, starFilter, dateFrom, dateTo, search, verifiedOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCrmReviews(queryParams);
      setItems(res.items ?? []);
      if (res.counts) setCounts(res.counts);
    } catch {
      setItems([]);
      toast.error("Sharhlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (reviewId: string, action: "approve" | "reject") => {
    setActingId(reviewId);
    try {
      await moderateCrmReview(reviewId, action);
      toast.success(action === "approve" ? "Sharh tasdiqlandi" : "Sharh rad etildi");
      await load();
    } catch {
      toast.error("Amal bajarilmadi");
    } finally {
      setActingId(null);
    }
  };

  const clearFilters = () => {
    setProductId("");
    setStarFilter("");
    setDateFrom("");
    setDateTo("");
    setSearch("");
    setVerifiedOnly(false);
  };

  const hasActiveFilters =
    Boolean(productId || starFilter || dateFrom || dateTo || search.trim() || verifiedOnly);

  const tabCount = (id: StatusTab) => counts[id] ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition",
              status === tab.id
                ? "bg-electric-500 text-white"
                : "bg-canvas text-text-400 ring-1 ring-border-subtle hover:text-text-200",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold",
                status === tab.id ? "bg-white/20 text-white" : "bg-surface text-text-400",
              )}
            >
              {tabCount(tab.id)}
            </span>
          </button>
        ))}
      </div>

      <div className="crm-surface-card overflow-hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 border-b border-border-subtle px-4 py-3 text-left sm:px-5"
        >
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-text-100">
            <Filter className="h-4 w-4 text-electric-500" />
            Filtrlar
            {hasActiveFilters ? (
              <span className="rounded-full bg-electric-500/12 px-2 py-0.5 text-[10px] font-bold text-electric-600">
                Faol
              </span>
            ) : null}
          </span>
          <span className="text-xs text-text-400">{filtersOpen ? "Yashirish" : "Ko'rsatish"}</span>
        </button>

        {filtersOpen ? (
          <div className="grid gap-3 border-b border-border-subtle p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <label className="text-xs font-medium text-text-400">Mahsulot</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-100"
              >
                <option value="">Barcha mahsulotlar</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-400">Yulduzcha</label>
              <select
                value={starFilter}
                onChange={(e) => setStarFilter(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-100"
              >
                {STAR_OPTIONS.map((opt) => (
                  <option key={opt.label} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-400">Qidiruv</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mijoz, izoh yoki mahsulot"
                  className="h-10 w-full rounded-lg border border-border-subtle bg-surface pl-9 pr-3 text-sm text-text-100 placeholder:text-text-400"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-400">Sanadan</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-100"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-text-400">Sanagacha</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-10 w-full rounded-lg border border-border-subtle bg-surface px-3 text-sm text-text-100"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-1">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 ring-1 ring-border-subtle">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="h-4 w-4 rounded text-electric-500"
                />
                <span className="text-xs font-medium text-text-100">Faqat tasdiqlangan xarid</span>
              </label>
              {hasActiveFilters ? (
                <Button type="button" size="sm" variant="secondary" onClick={clearFilters}>
                  Tozalash
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-canvas/50 px-6 py-12 text-center text-sm text-text-400">
          {hasActiveFilters
            ? "Filtr bo'yicha sharh topilmadi. Filtrlarni tozalab qayta urinib ko'ring."
            : status === "pending_moderation"
              ? "Moderatsiya kutayotgan sharh yo'q."
              : status === "all"
                ? "Hali sharh yo'q — mijozlar mahsulot sahifasidan baho qoldirishi mumkin."
                : "Bu bo'limda sharh topilmadi."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((review) => {
            const statusMeta = review.status ? STATUS_LABELS[review.status] : null;
            const productLabel = review.product_name?.trim() || "Mahsulot";
            return (
              <li key={review.id} className="crm-surface-card p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-canvas ring-1 ring-border-subtle">
                        <Package className="h-5 w-5 text-electric-500" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-text-100">{productLabel}</p>
                          {statusMeta ? (
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                                statusMeta.className,
                              )}
                            >
                              {statusMeta.label}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-text-400">
                          ID: {shortId(review.product_id)}
                          {review.created_at ? ` · ${formatReviewDate(review.created_at)}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-canvas/60 px-3.5 py-3 ring-1 ring-border-subtle/80">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-text-100">{review.author_name}</p>
                        <StarRow rating={review.rating} />
                      </div>
                      {review.is_verified_purchase ? (
                        <span className="mt-2 inline-flex rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-bold text-green">
                          Tasdiqlangan xarid
                        </span>
                      ) : null}
                      {review.body ? (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text-300">
                          {review.body}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm italic text-text-400">Izoh yozilmagan</p>
                      )}
                      {review.photo_urls?.length ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.photo_urls.map((url) => {
                            const src = resolveMediaUrl(url);
                            if (!src) return null;
                            return (
                              <a
                                key={url}
                                href={src}
                                target="_blank"
                                rel="noreferrer"
                                className="relative block h-16 w-16 overflow-hidden rounded-lg ring-1 ring-border-subtle"
                              >
                                <Image src={src} alt="" fill className="object-cover" unoptimized sizes="64px" />
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {review.status === "pending_moderation" ? (
                    <div className="flex shrink-0 gap-2 lg:flex-col">
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={actingId === review.id}
                        onClick={() => void act(review.id, "reject")}
                        className="flex-1 lg:flex-none"
                      >
                        <X className="mr-1 h-3.5 w-3.5" />
                        Rad etish
                      </Button>
                      <Button
                        size="sm"
                        disabled={actingId === review.id}
                        onClick={() => void act(review.id, "approve")}
                        className="flex-1 border-0 bg-electric-500 text-white hover:bg-electric-600 lg:flex-none"
                      >
                        <Check className="mr-1 h-3.5 w-3.5" />
                        Tasdiqlash
                      </Button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
