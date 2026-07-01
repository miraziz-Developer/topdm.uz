"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function CrmTip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("crm-tip-banner", className)}>
      <p className="text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </p>
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/50 bg-gradient-to-r from-primary/[0.04] to-transparent px-4 py-4 sm:px-6">
        <div className="flex min-w-0 gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-violet-500/10 text-primary shadow-sm ring-1 ring-primary/10">
              <Icon className="h-4 w-4" />
            </div>
          ) : null}
          <div>
            <h2 className="font-display text-base font-semibold leading-none text-foreground">{title}</h2>
            {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action}
      </div>
      <div className="p-4 sm:p-6">{children}</div>
    </section>
  );
}
