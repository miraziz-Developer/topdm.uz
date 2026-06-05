import type { ReactNode } from "react";

export default function PremiumMarketLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-canvas text-ink-900">{children}</div>;
}
