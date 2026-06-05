import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children?: ReactNode;
  className?: string;
};

export function BrandEmptyState({ title, description, icon: Icon, children, className }: Props) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-border-subtle bg-surface p-8 text-center shadow-card md:p-12",
        className,
      )}
    >
      <div className="mx-auto flex flex-col items-center gap-4">
        <BozorliiiLogo variant="icon" size="md" href={null} badge="CRM" />
        {Icon ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold-500/10 text-gold-600">
            <Icon className="h-6 w-6" />
          </div>
        ) : null}
      </div>
      <h3 className="mt-5 text-xl font-bold tracking-tight text-text-100">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-400">{description}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
    </div>
  );
}
