import { cn } from "@/lib/utils";

type LivePulseDotProps = {
  className?: string;
  variant?: "electric" | "green";
};

export function LivePulseDot({ className, variant = "electric" }: LivePulseDotProps) {
  const color = variant === "green" ? "bg-green" : "bg-electric-500";

  return (
    <span className={cn("relative inline-flex h-2 w-2 shrink-0", className)} aria-hidden>
      <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", color)} />
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}
