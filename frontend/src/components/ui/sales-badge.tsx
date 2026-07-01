import { cn } from "@/lib/utils";
import { salesBadgeClass, type SalesBadgeVariant } from "@/components/brand/sales-ui";

type Props = {
  variant: SalesBadgeVariant;
  children: React.ReactNode;
  className?: string;
  pulse?: boolean;
};

/** Sotuv psixologiyasi badge — chegirma, jonli, ishonch, shoshilinchlik */
export function SalesBadge({ variant, children, className, pulse }: Props) {
  return (
    <span
      className={cn(
        salesBadgeClass[variant],
        pulse && variant === "hot" && "animate-pulse",
        className,
      )}
    >
      {children}
    </span>
  );
}
