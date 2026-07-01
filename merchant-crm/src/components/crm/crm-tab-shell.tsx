"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { cn } from "@/lib/utils";

export type CrmTab = {
  id: string;
  label: string;
  href: string;
  icon?: LucideIcon;
  hint?: string;
};

type Props = {
  tabs: readonly CrmTab[];
  activeTab: string;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function CrmTabShell({ tabs, activeTab, title, description, children }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = tabs.find((t) => t.id === activeTab);

  return (
    <div className="space-y-6">
      <div className="crm-surface-card p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">CRM</p>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight md:text-3xl">
              <span className="text-gradient-hero">{title}</span>
            </h1>
            {description ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
            {active?.hint ? (
              <p className="mt-3 inline-flex rounded-xl border border-primary/15 bg-primary/5 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                {active.hint}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-5 inline-flex w-full flex-wrap gap-1 rounded-xl border border-border/60 bg-muted/50 p-1 backdrop-blur sm:w-auto"
          role="tablist"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const url = new URL(tab.href, "http://local");
            const samePath = pathname === url.pathname;
            const tabParam = url.searchParams.get("tab");
            const currentTab = searchParams.get("tab") ?? tabs[0]?.id;
            const isActive = samePath && (tabParam ? tabParam === currentTab : tab.id === activeTab);

            return (
              <Link
                key={tab.id}
                href={tab.href}
                role="tab"
                aria-selected={isActive}
                className={cn(
                  "inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-card text-foreground shadow-glow"
                    : "text-muted-foreground hover:bg-card/60 hover:text-foreground",
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="crm-page-enter">{children}</div>
    </div>
  );
}
