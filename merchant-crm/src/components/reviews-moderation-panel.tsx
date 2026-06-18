"use client";

import { Check, Star, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getCrmReviews, moderateCrmReview, type CrmReviewRow } from "@/lib/api";
import { cn } from "@/lib/utils";

const STATUS_TABS = [
  { id: "pending_moderation", label: "Kutilmoqda" },
  { id: "approved", label: "Tasdiqlangan" },
  { id: "rejected", label: "Rad etilgan" },
] as const;

export function ReviewsModerationPanel() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]["id"]>("pending_moderation");
  const [items, setItems] = useState<CrmReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCrmReviews(status);
      setItems(res.items ?? []);
    } catch {
      setItems([]);
      toast.error("Sharhlarni yuklab bo'lmadi");
    } finally {
      setLoading(false);
    }
  }, [status]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatus(tab.id)}
            className={cn(
              "rounded-full px-4 py-2 text-xs font-semibold transition",
              status === tab.id
                ? "bg-electric-500 text-white"
                : "bg-canvas text-text-400 ring-1 ring-border-subtle hover:text-text-200",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton h-40 rounded-2xl" />
      ) : !items.length ? (
        <div className="rounded-2xl border border-dashed border-border-subtle bg-canvas/50 px-6 py-12 text-center text-sm text-text-400">
          {status === "pending_moderation"
            ? "Moderatsiya kutayotgan sharh yo'q."
            : "Bu bo'limda sharh topilmadi."}
        </div>
      ) : (
        <ul className="space-y-3">
          {items.map((review) => (
            <li key={review.id} className="crm-surface-card p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-100">{review.author_name}</p>
                  <div className="mt-1 flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "h-3.5 w-3.5",
                          i < review.rating ? "fill-amber-400 text-amber-400" : "text-text-400",
                        )}
                      />
                    ))}
                    {review.is_verified_purchase ? (
                      <span className="ml-2 rounded-full bg-green/10 px-2 py-0.5 text-[10px] font-bold text-green">
                        Tasdiqlangan xarid
                      </span>
                    ) : null}
                  </div>
                  {review.body ? <p className="mt-2 text-sm text-text-300">{review.body}</p> : null}
                  {review.photo_urls?.length ? (
                    <p className="mt-1 text-xs text-text-400">{review.photo_urls.length} ta rasm</p>
                  ) : null}
                </div>
                {status === "pending_moderation" ? (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={actingId === review.id}
                      onClick={() => void act(review.id, "reject")}
                    >
                      <X className="mr-1 h-3.5 w-3.5" />
                      Rad
                    </Button>
                    <Button
                      size="sm"
                      disabled={actingId === review.id}
                      onClick={() => void act(review.id, "approve")}
                    >
                      <Check className="mr-1 h-3.5 w-3.5" />
                      Tasdiqlash
                    </Button>
                  </div>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
