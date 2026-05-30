import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

type BrandStarRatingProps = {
  rating?: number;
  className?: string;
};

export function BrandStarRating({ rating = 4.8, className }: BrandStarRatingProps) {
  const full = Math.floor(rating);
  const partial = rating - full >= 0.5;

  return (
    <div className={cn("flex items-center gap-0.5", className)} aria-label={`${rating} yulduz`}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < full || (index === full && partial);
        return (
          <Star
            key={index}
            className={cn(
              "h-3.5 w-3.5",
              filled ? "fill-electric-500 text-electric-500" : "fill-electric-500/15 text-electric-500/25",
            )}
          />
        );
      })}
      <span className="ml-1 text-[11px] font-bold text-electric-500">{rating.toFixed(1)}</span>
    </div>
  );
}
