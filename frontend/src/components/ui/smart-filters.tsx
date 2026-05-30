"use client";

import { useMemo } from "react";

import { Button } from "@/components/ui/button";
import { useLocationStore } from "@/stores/location-store";
import { colorFilterMatchesProduct } from "@/lib/visual-search-color";
import type { Product } from "@/types";

export type SmartFilterState = {
  colors: string[];
  materials: string[];
  blocks: string[];
  minPrice?: number;
  maxPrice?: number;
};

type SmartFiltersProps = {
  value: SmartFilterState;
  onChange: (next: SmartFilterState) => void;
  products: Product[];
};

const COLOR_OPTIONS = ["Sariq", "Qora", "Oq", "Ko'k", "Qizil", "Yashil", "Bej"];
const MATERIAL_OPTIONS = ["Paxta", "Charm", "Denim", "Atalas"];
const BLOCK_OPTIONS = ["38-blok", "40-blok", "42-blok", "44-blok"];

export function SmartFilters({ value, onChange, products }: SmartFiltersProps) {
  const currentBlock = useLocationStore((state) => state.currentBlock);
  const setCurrentBlock = useLocationStore((state) => state.setCurrentBlock);

  const blocks = useMemo(() => {
    const fromProducts = Array.from(new Set(products.map((item) => item.shop.floor).filter(Boolean))) as string[];
    return fromProducts.length ? fromProducts : BLOCK_OPTIONS;
  }, [products]);

  const toggle = (key: keyof Pick<SmartFilterState, "colors" | "materials" | "blocks">, item: string) => {
    const list = value[key];
    const next = list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];
    onChange({ ...value, [key]: next });
  };

  return (
    <div className="space-y-4 overflow-hidden rounded-3xl border border-border-subtle bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-ink-900">Aqlli filtrlar</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange({ colors: [], materials: [], blocks: [], minPrice: undefined, maxPrice: undefined })}
        >
          Clear All
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCurrentBlock(currentBlock ? null : blocks[0] ?? "42-blok")}
          className={`rounded-full px-3 py-1.5 text-xs ${currentBlock ? "bg-electric-500 text-white" : "border border-border-default text-ink-700"}`}
        >
          Faqat men turgan blok
        </button>
        {blocks.map((block) => (
          <button
            key={block}
            type="button"
            onClick={() => toggle("blocks", block)}
            className={`rounded-full px-3 py-1.5 text-xs ${value.blocks.includes(block) ? "bg-ink-900 text-white" : "border border-border-default text-ink-700"}`}
          >
            {block}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {COLOR_OPTIONS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => toggle("colors", color)}
            className={`rounded-full px-3 py-1.5 text-xs ${value.colors.includes(color) ? "bg-neon-500 text-white" : "border border-border-default text-ink-700"}`}
          >
            {color}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {MATERIAL_OPTIONS.map((material) => (
          <button
            key={material}
            type="button"
            onClick={() => toggle("materials", material)}
            className={`rounded-full px-3 py-1.5 text-xs ${value.materials.includes(material) ? "bg-electric-500 text-white" : "border border-border-default text-ink-700"}`}
          >
            {material}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          type="number"
          placeholder="Min narx"
          value={value.minPrice ?? ""}
          onChange={(event) => onChange({ ...value, minPrice: event.target.value ? Number(event.target.value) : undefined })}
          className="rounded-xl border border-border-default px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Max narx"
          value={value.maxPrice ?? ""}
          onChange={(event) => onChange({ ...value, maxPrice: event.target.value ? Number(event.target.value) : undefined })}
          className="rounded-xl border border-border-default px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}

export function applySmartFilters(
  products: Product[],
  filters: SmartFilterState,
  currentBlock: string | null,
  options?: { skipColorFilter?: boolean },
) {
  return products.filter((product) => {
    if (currentBlock && product.shop.floor && product.shop.floor !== currentBlock) return false;
    if (filters.blocks.length && product.shop.floor && !filters.blocks.includes(product.shop.floor)) return false;
    if (filters.minPrice && product.price < filters.minPrice) return false;
    if (filters.maxPrice && product.price > filters.maxPrice) return false;
    if (!options?.skipColorFilter && filters.colors.length) {
      if (!filters.colors.some((color) => colorFilterMatchesProduct(color, product.name, product.category))) {
        return false;
      }
    }
    if (filters.materials.length) {
      const haystack = `${product.name} ${product.category ?? ""}`.toLowerCase();
      if (!filters.materials.some((material) => haystack.includes(material.toLowerCase()))) return false;
    }
    return true;
  });
}
