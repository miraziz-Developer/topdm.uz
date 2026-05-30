import { cn } from "@/lib/utils";

export function LivePill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-red/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-red",
        className,
      )}
    >
      <span className="h-2 w-2 animate-pulse rounded-full bg-red" />
      Live
    </span>
  );
}
