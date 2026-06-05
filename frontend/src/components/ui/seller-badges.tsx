import { Award, Clock3, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Product } from "@/types";

type SellerBadgesProps = {
  product: Product;
};

const BADGE_STYLES: Record<string, string> = {
  "Ippodrom faxri": "border-electric-100 bg-electric-50 text-electric-900",
  "Ishonchli sotuvchi": "border-electric-100/80 bg-white text-ink-800",
  "Eng tez javob beradigan": "border-electric-200 bg-electric-50/80 text-electric-800",
};

const ICON_STYLES: Record<string, string> = {
  "Ippodrom faxri": "text-electric-600",
  "Ishonchli sotuvchi": "text-electric-500",
  "Eng tez javob beradigan": "text-electric-600",
};

export function SellerBadges({ product }: SellerBadgesProps) {
  const badges = [
    product.view_count && product.view_count > 80 ? { icon: Award, label: "Ippodrom faxri" } : null,
    product.shop.name.length % 2 === 0 ? { icon: ShieldCheck, label: "Ishonchli sotuvchi" } : null,
    { icon: Clock3, label: "Eng tez javob beradigan" },
  ].filter(Boolean) as Array<{ icon: typeof Award; label: string }>;

  return (
    <div className="flex flex-wrap gap-2">
      {badges.map((badge) => (
        <span
          key={badge.label}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
            BADGE_STYLES[badge.label],
          )}
        >
          <badge.icon className={cn("h-3.5 w-3.5", ICON_STYLES[badge.label])} />
          {badge.label}
        </span>
      ))}
    </div>
  );
}
