import type { ReactNode } from "react";

import { MARKET } from "@/components/brand/premium-market-ui";
import { cn } from "@/lib/utils";

type Props = {
  eyebrow?: string;
  eyebrowVariant?: "gold" | "electric";
  title: ReactNode;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PremiumPageHero({
  eyebrow,
  eyebrowVariant = "gold",
  title,
  description,
  actions,
  className,
}: Props) {
  return (
    <header className={cn(MARKET.pageHero, className)}>
      <div className="min-w-0 flex-1">
        {eyebrow ? (
          <p className={eyebrowVariant === "gold" ? MARKET.eyebrowGold : MARKET.eyebrowElectric}>{eyebrow}</p>
        ) : null}
        <h1 className="market-page-title">{title}</h1>
        {description ? <p className="market-page-lead">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
