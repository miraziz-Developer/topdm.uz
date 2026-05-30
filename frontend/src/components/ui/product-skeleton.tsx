import { cn } from "@/lib/utils";

type ProductSkeletonProps = {
  variant?: "card" | "detail" | "row";
  className?: string;
};

export function ProductSkeleton({ variant = "card", className }: ProductSkeletonProps) {
  if (variant === "detail") {
    return (
      <div className={cn("grid gap-8 md:grid-cols-2", className)}>
        <div className="skeleton aspect-square rounded-3xl" />
        <div className="space-y-4">
          <div className="skeleton h-6 w-24 rounded-full" />
          <div className="skeleton h-10 w-4/5 rounded-xl" />
          <div className="skeleton h-4 w-2/3 rounded-lg" />
          <div className="skeleton h-28 w-full rounded-3xl" />
          <div className="skeleton h-14 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className={cn("flex gap-4 rounded-3xl border border-border-subtle bg-white p-4", className)}>
        <div className="skeleton h-24 w-24 rounded-2xl" />
        <div className="flex-1 space-y-3">
          <div className="skeleton h-4 w-1/3 rounded-full" />
          <div className="skeleton h-6 w-4/5 rounded-lg" />
          <div className="skeleton h-5 w-1/2 rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-border-subtle bg-white", className)}>
      <div className="skeleton aspect-[4/5] w-full" />
      <div className="space-y-3 p-4">
        <div className="skeleton h-3 w-1/2 rounded-full" />
        <div className="skeleton h-5 w-4/5 rounded-lg" />
        <div className="skeleton h-6 w-1/3 rounded-lg" />
      </div>
    </div>
  );
}
