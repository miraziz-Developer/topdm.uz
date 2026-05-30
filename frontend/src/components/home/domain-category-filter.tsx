"use client";

import { motion } from "framer-motion";
import { useRef } from "react";

import { DOMAIN_CATEGORIES, type DomainCategoryId } from "@/lib/home-categories";
import { cn } from "@/lib/utils";

export type DomainCategoryFilterProps = {
  value: DomainCategoryId;
  onChange: (id: DomainCategoryId) => void;
  className?: string;
};

export function DomainCategoryFilter({ value, onChange, className }: DomainCategoryFilterProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-6", className)} aria-label="Kategoriya filtri">
      <div
        ref={scrollerRef}
        className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-2 pt-2"
        role="tablist"
      >
        {DOMAIN_CATEGORIES.map((category) => {
          const active = category.id === value;
          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(category.id)}
              className={cn(
                "relative shrink-0 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]",
                active
                  ? "text-white"
                  : "border border-border-subtle bg-white/70 text-ink-600 backdrop-blur-sm hover:border-electric-500/35 hover:text-electric-500 dark:bg-white/10",
              )}
            >
              {active ? (
                <motion.span
                  layoutId="category-chip-active"
                  className="absolute inset-0 rounded-full bg-electric-500 shadow-[0_0_20px_rgba(0,102,255,0.3)]"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                />
              ) : null}
              <span className="relative z-10">{category.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
