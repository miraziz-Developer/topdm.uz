import { cva, type VariantProps } from "class-variance-authority";
import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

const badgeVariants = cva("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", {
  variants: {
    variant: {
      default: "bg-elevated text-300 border border-subtle",
      success: "bg-accent-green/20 text-accent-green border border-accent-green/40",
      warning: "bg-gold-500/20 text-gold-500 border border-gold-500/40",
      danger: "bg-accent-red/20 text-accent-red border border-accent-red/40",
    },
  },
  defaultVariants: { variant: "default" },
});

type BadgeProps = HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={clsx(badgeVariants({ variant }), className)} {...props} />;
}
