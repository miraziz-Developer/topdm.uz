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
    <div className="space-y-5">
      <div className="crm-hero-card crm-mesh-bg p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-electric-600">CRM</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-100 md:text-[1.75rem]">{title}</h1>
            {description ? <p className="mt-2 text-sm leading-relaxed text-text-400">{description}</p> : null}
            {active?.hint ? (
              <p className="mt-3 inline-flex rounded-xl bg-canvas/80 px-3 py-1.5 text-xs font-medium text-text-300 ring-1 ring-border-subtle">
                {active.hint}
              </p>
            ) : null}
          </div>
        </div>

        <div
          className="mt-5 flex gap-1 overflow-x-auto rounded-xl bg-canvas/60 p-1 ring-1 ring-border-subtle/80"
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
                  "flex shrink-0 items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-200",
                  isActive
                    ? "bg-surface text-electric-600 shadow-sm ring-1 ring-border-subtle"
                    : "text-text-400 hover:text-text-100",
                )}
              >
                {Icon ? <Icon className={cn("h-4 w-4", isActive && "text-electric-500")} /> : null}
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
