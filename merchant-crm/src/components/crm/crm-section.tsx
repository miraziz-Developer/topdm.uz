"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function CrmTip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("crm-tip-banner", className)}>
      <p className="text-sm leading-relaxed text-text-300">{children}</p>
    </div>
  );
}

export function CrmSection({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("crm-surface-card overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle bg-canvas/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600">
              <Icon className="h-5 w-5" />
            </div>
          ) : null}
          <div>
            <h2 className="text-base font-semibold text-text-100">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-text-400">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}
