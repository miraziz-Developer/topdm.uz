import type { ReactNode } from "react";

type Props = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function CrmPageHeader({ eyebrow = "CRM", title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-500">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-100 md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-text-400">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
