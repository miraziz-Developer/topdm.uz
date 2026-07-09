import Link from "next/link";

import { cn } from "@/lib/utils";

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("admin-card", className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "blue" | "green" | "amber" | "purple" | "red";
  href?: string;
}) {
  const toneClass = {
    blue: "from-primary/20 to-primary/5 text-primary",
    green: "from-emerald-500/20 to-emerald-500/5 text-emerald-400",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-400",
    purple: "from-violet-500/20 to-violet-500/5 text-violet-400",
    red: "from-red-500/20 to-red-500/5 text-red-400",
  }[tone];

  const inner = (
    <>
      <div className={cn("absolute inset-0 bg-gradient-to-br opacity-60", toneClass.split(" ")[0], toneClass.split(" ")[1])} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        {icon ? (
          <div className={cn("rounded-xl bg-gradient-to-br p-2.5", toneClass)}>{icon}</div>
        ) : null}
      </div>
    </>
  );

  if (href) {
    return (
      <Link href={href} className="admin-card relative block overflow-hidden transition hover:ring-1 hover:ring-primary/40">
        {inner}
      </Link>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {inner}
    </Card>
  );
}
