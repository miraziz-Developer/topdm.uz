import { MapPin, ShieldCheck, Sparkles, Timer } from "lucide-react";

import { MARKET } from "@/components/brand/premium-market-ui";
import { cn } from "@/lib/utils";

const ITEMS = [
  { icon: ShieldCheck, label: "Xavfsiz bron", tone: "text-electric-600" },
  { icon: Timer, label: "45 daq saqlanadi", tone: "text-amber-700" },
  { icon: MapPin, label: "Do'konda olib ketish", tone: "text-green" },
  { icon: Sparkles, label: "AI qidiruv", tone: "text-neon-500" },
] as const;

export function PremiumTrustStrip({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn(MARKET.trustStrip, compact && "py-2", className)} role="list" aria-label="Ishonch">
      {ITEMS.map(({ icon: Icon, label, tone }) => (
        <span key={label} role="listitem" className="market-trust-item">
          <Icon className={cn("h-3.5 w-3.5 shrink-0", tone)} aria-hidden />
          {!compact ? <span>{label}</span> : null}
        </span>
      ))}
    </div>
  );
}
