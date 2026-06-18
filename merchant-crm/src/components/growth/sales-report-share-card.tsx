"use client";

import { Share2, Sparkles, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CrmSection } from "@/components/crm/crm-section";
import { getSalesReportCard } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";

export function SalesReportShareCard() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [card, setCard] = useState<Awaited<ReturnType<typeof getSalesReportCard>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getSalesReportCard(period)
      .then((res) => {
        if (!cancelled) setCard(res);
      })
      .catch(() => toast.error("Hisobot yuklanmadi"))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  const shareTelegram = () => {
    if (!card) return;
    const url = card.telegram_share_url;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copyText = async () => {
    if (!card) return;
    try {
      await navigator.clipboard.writeText(card.share_text);
      toast.success("Matn nusxalandi");
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

  return (
    <CrmSection
      title="Savdo hisoboti"
      description="Guruhlarga ulashish — hamkasblar ham Bozorliii ga qiziqadi"
      icon={Sparkles}
    >
      <div className="mb-3 flex gap-2">
        {(["week", "month"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p)}
            className={cn(
              "rounded-full px-4 py-1.5 text-xs font-semibold",
              period === p ? "bg-electric-500 text-white" : "bg-canvas text-text-400 ring-1 ring-border-subtle",
            )}
          >
            {p === "week" ? "Hafta" : "Oy"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-2xl bg-canvas" />
      ) : card ? (
        <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-electric-600 via-violet-600 to-fuchsia-600 p-[1px] shadow-lg">
          <div className="rounded-[15px] bg-surface/95 p-5 backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-wider text-electric-600">{card.period_label} hisobot</p>
            <h3 className="mt-1 text-xl font-bold text-text-100">{card.shop_name}</h3>
            <p className="mt-3 text-sm leading-relaxed text-text-300">{card.headline}</p>
            <div className="mt-4 flex flex-wrap gap-4">
              <div>
                <p className="text-[10px] uppercase text-text-400">Buyurtmalar</p>
                <p className="text-2xl font-bold text-text-100">{card.orders_count}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase text-text-400">Savdo</p>
                <p className="text-2xl font-bold text-text-100">{formatPrice(card.revenue_uzs)}</p>
              </div>
              {card.growth_pct !== 0 ? (
                <div className="flex items-end gap-1 text-emerald-600">
                  <TrendingUp className="h-5 w-5" />
                  <span className="text-lg font-bold">{card.growth_pct > 0 ? "+" : ""}{card.growth_pct}%</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="crm-btn-primary inline-flex items-center gap-2" onClick={shareTelegram}>
          <Share2 className="h-4 w-4" />
          Telegram guruhga ulashish
        </button>
        <button type="button" className="crm-btn-secondary" onClick={() => void copyText()}>
          Matnni nusxalash
        </button>
      </div>
    </CrmSection>
  );
}
