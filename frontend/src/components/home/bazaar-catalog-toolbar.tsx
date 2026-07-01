"use client";

import { motion } from "framer-motion";
import { ChevronDown, Globe2, Package, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { useT } from "@/i18n/locale-provider";
import {
  BLOCK_SECTORS,
  type BazaarCatalogFilters,
  type CatalogOrigin,
  MARKET_ZONES,
  normalizeFilterPrices,
  ROOT_CATEGORIES,
  type SaleMode,
} from "@/lib/home-catalog-filters";
import { formatUzPriceInput } from "@/lib/price-input";
import { isChinaMarketEnabled } from "@/lib/runtime-flags";
import { cn } from "@/lib/utils";

type BazaarCatalogToolbarProps = {
  filters: BazaarCatalogFilters;
  onChange: (next: BazaarCatalogFilters) => void;
  className?: string;
  /** Xitoy rejimi — qorong'u premium toolbar */
};

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex min-w-[130px] flex-1 flex-col gap-1">
      <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-xl border border-border-subtle bg-white py-2 pl-3 pr-8 text-[13px] font-medium text-ink-900 outline-none transition focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20"
        >
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
      </div>
    </label>
  );
}

export function BazaarCatalogToolbar({ filters, onChange, className }: BazaarCatalogToolbarProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const set = (patch: Partial<BazaarCatalogFilters>) => onChange({ ...filters, ...patch });

  const commitPrices = () => {
    onChange(
      normalizeFilterPrices({
        ...filters,
        minPrice: filters.minPrice ? formatUzPriceInput(filters.minPrice) : "",
        maxPrice: filters.maxPrice ? formatUzPriceInput(filters.maxPrice) : "",
      }),
    );
  };

  const marketOptions = MARKET_ZONES.map((z) =>
    z.id === "all" ? { ...z, label: t("home.filter.allZones") } : z,
  );
  const blockOptions = BLOCK_SECTORS.map((z) =>
    z.id === "all" ? { ...z, label: t("home.filter.allBlocks") } : z,
  );
  const categoryOptions = ROOT_CATEGORIES.map((z) =>
    z.id === "all" ? { ...z, label: t("home.filter.allCategories") } : z,
  );

  const chinaEnabled = isChinaMarketEnabled();
  const isChina = chinaEnabled && filters.catalogOrigin === "china";

  const activeFiltersCount = [
    filters.marketZone !== "all",
    filters.blockSector !== "all",
    filters.rootCategory !== "all",
    Boolean(filters.minPrice),
    Boolean(filters.maxPrice),
  ].filter(Boolean).length;

  return (
    <section className={cn("w-full", className)} aria-label="Bozor filtrlari">
      {/* Compact top bar — always visible */}
      <div className="flex h-11 items-center gap-2 px-4 sm:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scrollbar-none">
          {/* Chakana / Ulgurji */}
          <div
            className={cn(
              "flex shrink-0 rounded-full border border-border-subtle bg-white p-0.5 shadow-sm transition-opacity",
              isChina && "pointer-events-none opacity-45",
            )}
          >
            {(
              [
                { id: "Chakana" as SaleMode, label: t("home.sale.chakana"), icon: ShoppingBag },
                { id: "Optom" as SaleMode, label: t("home.sale.optom"), icon: Package },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = !isChina && filters.saleMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => set({ catalogOrigin: "local", saleMode: id })}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold transition-all duration-200 sm:px-3",
                    active ? "text-white" : "text-ink-500 hover:text-ink-900",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="sale-mode-pill"
                      className="absolute inset-0 rounded-full bg-electric-500 shadow-sm"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5 whitespace-nowrap">
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </span>
                </button>
              );
            })}
          </div>

          {chinaEnabled ? (
            <button
              type="button"
              onClick={() => set({ catalogOrigin: "china" as CatalogOrigin })}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-semibold transition-all duration-300 sm:px-3",
                isChina
                  ? "border-electric-500/40 bg-electric-500 text-white shadow-sm"
                  : "border-border-subtle bg-white text-ink-600 hover:border-electric-500/35 hover:text-electric-500",
              )}
            >
              <Globe2 className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{t("home.sale.china")}</span>
            </button>
          ) : null}
        </div>

        {/* Filter toggle button */}
        <button
          type="button"
          disabled={isChina}
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all",
            isChina && "cursor-not-allowed opacity-40",
            !isChina &&
              (expanded || activeFiltersCount > 0
                ? "border-electric-500 bg-electric-500/10 text-electric-600"
                : "border-border-subtle bg-white text-ink-600 hover:border-electric-500/40"),
          )}
        >
          {expanded ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <SlidersHorizontal className="h-3.5 w-3.5" />
          )}
          Filtr
          {activeFiltersCount > 0 && !expanded && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-electric-500 text-[9px] font-bold text-white">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Expanded filter panel */}
      <motion.div
        initial={false}
        animate={{ height: expanded ? "auto" : 0, opacity: expanded ? 1 : 0 }}
        transition={{ duration: 0.22, ease: "easeInOut" }}
        className="overflow-hidden"
      >
        <div className="border-t border-border-subtle bg-white px-4 py-4 sm:px-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <SelectField
              label={t("home.filter.market")}
              value={filters.marketZone}
              options={marketOptions}
              onChange={(v) => set({ marketZone: v as BazaarCatalogFilters["marketZone"] })}
            />
            <SelectField
              label={t("home.filter.block")}
              value={filters.blockSector}
              options={blockOptions}
              onChange={(v) => set({ blockSector: v as BazaarCatalogFilters["blockSector"] })}
            />
            <SelectField
              label={t("home.filter.category")}
              value={filters.rootCategory}
              options={categoryOptions}
              onChange={(v) => set({ rootCategory: v as BazaarCatalogFilters["rootCategory"] })}
            />
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                {t("home.filter.minPrice")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="50 000"
                value={filters.minPrice}
                onChange={(e) => set({ minPrice: formatUzPriceInput(e.target.value) })}
                onBlur={commitPrices}
                className="rounded-xl border border-border-subtle bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-gray-500">
                {t("home.filter.maxPrice")}
              </span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="2 000 000"
                value={filters.maxPrice}
                onChange={(e) => set({ maxPrice: formatUzPriceInput(e.target.value) })}
                onBlur={commitPrices}
                className="rounded-xl border border-border-subtle bg-white px-3 py-2 text-[13px] font-medium outline-none focus:border-electric-500 focus:ring-2 focus:ring-electric-500/20"
              />
            </label>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
