import { cn } from "@/lib/utils";
import { salesBadgeClass } from "@/components/brand/sales-ui";

export function LivePill({ className }: { className?: string }) {
  return (
    <span className={cn(salesBadgeClass.hot, "px-2.5 py-1 text-[11px] normal-case tracking-wide", className)}>
      Live
    </span>
  );
}
