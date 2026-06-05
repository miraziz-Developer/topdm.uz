"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe2, Loader2, Search, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";

import {
  marketBtnGhost,
  marketBtnPrimary,
  marketCard,
  marketEyebrow,
  marketGlass,
  marketInput,
  marketPrice,
} from "@/components/market/market-ui";
import {
  autoSearchItemToProduct,
  fetchChinaAutoSearch,
  formatChinaSearchError,
  formatUzs,
  type AutoSearchItem,
} from "@/lib/china-auto-search";
import { useCartStore } from "@/stores/cart-store";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "/placeholder.png";

type ChinaProductPageProps = {
  initialQuery?: string;
  /** Bosh sahifada — header yashirin, fon sayt bilan bir xil */
  compact?: boolean;
};

export function ChinaProductPage({ initialQuery = "", compact = false }: ChinaProductPageProps) {
  const router = useRouter();
  const { push } = useToast();
  const addItem = useCartStore((s) => s.addItem);

  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translated, setTranslated] = useState<string | null>(null);
  const [items, setItems] = useState<AutoSearchItem[]>([]);
  const [page, setPage] = useState(1);

  const runSearch = useCallback(async (nextPage = 1) => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchChinaAutoSearch(q, nextPage);
      setTranslated(res.translated_query);
      setPage(res.page);
      setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items]));
      if (res.items.length === 0 && nextPage === 1) {
        setError("Hech narsa topilmadi — boshqa so'z bilan urinib ko'ring");
      }
    } catch (err) {
      setError(formatChinaSearchError(err));
      if (nextPage === 1) setItems([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const onSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    void runSearch(1);
  };

  const addToCart = (item: AutoSearchItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(autoSearchItemToProduct(item), 1, "group");
    push("Savatga qo'shildi", "success");
  };

  return (
    <div className={cn(compact ? "" : "min-h-dvh bg-canvas text-ink-900")}>
      <div
        className={cn(
          "mx-auto w-full",
          compact ? "max-w-7xl" : "max-w-7xl px-4 pb-24 pt-4 sm:px-6 sm:pt-6",
        )}
      >
        {!compact ? (
          <header className="mb-6">
            <p className={marketEyebrow}>Xitoy bozori</p>
            <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
              <Globe2 className="h-7 w-7 text-electric-500" />
              Avtomatik qidiruv
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-text-400">
              O&apos;zbekcha yozing — tarjima va Taobao qidiruv avtomatik. Yakuniy narx UZS da.
            </p>
          </header>
        ) : (
          <div className={cn("mb-4 px-4 sm:px-5", compact && "pt-1")}>
            <p className={marketEyebrow}>Xitoydan tovarlar</p>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className={cn(marketGlass, compact && "mx-4 sm:mx-5")}
        >
          <label className="text-xs font-bold uppercase tracking-widest text-text-400">
            Nima qidiryapsiz?
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Masalan: erkaklar shim, qishki kurtka"
              className={marketInput}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className={cn(marketBtnPrimary, "h-12 shrink-0 px-6 disabled:opacity-50")}
            >
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Search className="h-5 w-5" />}
              Qidirish
            </button>
          </div>
          {translated && translated !== query.trim() ? (
            <p className="mt-2 text-xs text-text-400">
              Tarjima: <span className="font-medium text-electric-500">{translated}</span>
            </p>
          ) : null}
          {translated?.includes("(demo vitrina)") ? (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              Demo rejim — BTS uchrashuvi uchun namuna tovarlar. Taobao API ulangach haqiqiy qidiruv ishlaydi.
            </p>
          ) : null}
        </form>

        {error ? (
          <p
            className={cn(
              "mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700",
              compact && "mx-4 sm:mx-5",
            )}
          >
            {error}
          </p>
        ) : null}

        <div className={cn("mt-6", compact && "px-4 sm:px-5")}>
          {loading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="h-9 w-9 animate-spin text-electric-500" />
              <p className="text-sm text-text-400">Taobao qidirilmoqda…</p>
            </div>
          ) : items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {items.map((item, index) => (
                  <motion.article
                    key={item.item_id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.35), duration: 0.3 }}
                    className={cn(marketCard, "group flex flex-col")}
                  >
                    <Link
                      href={`/market/china/${encodeURIComponent(item.item_id)}`}
                      className="relative aspect-[4/5] overflow-hidden bg-bg-input"
                    >
                      <Image
                        src={item.image_url || PLACEHOLDER}
                        alt={item.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        unoptimized
                        sizes="(max-width: 640px) 50vw, 25vw"
                      />
                      <span className="absolute left-2 top-2 rounded-full bg-electric-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
                        Xitoy
                      </span>
                    </Link>
                    <div className="flex flex-1 flex-col p-3">
                      <Link href={`/market/china/${encodeURIComponent(item.item_id)}`}>
                        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-ink-900">
                          {item.title}
                        </h3>
                      </Link>
                      <p className={cn("mt-1.5", marketPrice)}>{formatUzs(item.total_price_uzs)}</p>
                      <button
                        type="button"
                        onClick={(e) => addToCart(item, e)}
                        className={cn(marketBtnGhost, "mt-3 w-full py-2.5 text-sm")}
                      >
                        <ShoppingBag className="h-4 w-4" />
                        Savatcha
                      </button>
                    </div>
                  </motion.article>
                ))}
              </div>
              {!loading && items.length >= 8 ? (
                <div className="mt-6 flex justify-center">
                  <button
                    type="button"
                    onClick={() => void runSearch(page + 1)}
                    className={marketBtnGhost}
                  >
                    Ko&apos;proq yuklash
                  </button>
                </div>
              ) : null}
            </>
          ) : !loading && !error ? (
            <p className="py-12 text-center text-sm text-text-400">
              Mahsulot nomini yozib «Qidirish» ni bosing
            </p>
          ) : null}
        </div>

        {!compact ? (
          <p className="mt-8 text-center">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="text-sm text-text-400 transition-colors hover:text-electric-500"
            >
              ← Bosh sahifaga
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
