import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  eyebrow?: string;
  eyebrowClassName?: string;
  title: string;
  titleClassName?: string;
  description?: string;
  descriptionClassName?: string;
  action?: React.ReactNode;
  className?: string;
};

export function SectionHeader({
  eyebrow,
  eyebrowClassName,
  title,
  titleClassName,
  description,
  descriptionClassName,
  action,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("mb-8 flex items-end justify-between gap-4", className)}>
      <div>
        {eyebrow ? (
          <p className={cn(eyebrowClassName ?? "eyebrow-pill mb-3")}>{eyebrow}</p>
        ) : null}
        <h2 className={cn("display-section text-ink-900", titleClassName)}>{title}</h2>
        {description ? (
          <p
            className={
              descriptionClassName ??
              "mt-2.5 max-w-2xl text-sm font-medium leading-relaxed text-neutral-600 md:text-base"
            }
          >
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
