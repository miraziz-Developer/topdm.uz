"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";

import { importChinaProductById } from "@/lib/china-catalog";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type Props = {
  onImported: (itemId: string) => void;
  className?: string;
};

export function ChinaProductIdSearch({ onImported, className }: Props) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const raw = query.trim();
    if (!raw || loading) return;
    setLoading(true);
    setError(null);
    try {
      const item = await importChinaProductById(raw);
      onImported(item.item_id);
      setQuery("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("home.china.importError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn("border-t border-border-subtle bg-white px-4 py-3 sm:px-6", className)}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">{t("home.china.searchLabel")}</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("home.china.searchPlaceholder")}
          className="h-10 min-w-0 flex-1 rounded-xl border border-border-subtle bg-canvas px-3 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
          onKeyDown={(e) => e.key === "Enter" && void submit()}
          disabled={loading}
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={loading || !query.trim()}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t("home.china.importBtn")}
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
