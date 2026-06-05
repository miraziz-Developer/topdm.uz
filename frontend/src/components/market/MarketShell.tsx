"use client";

import type { ReactNode } from "react";
import Link from "next/link";

import { MarketNavigation } from "@/components/market/MarketNavigation";
import { marketEyebrow, marketGlass, marketPage } from "@/components/market/market-ui";

type Props = {
  children: ReactNode;
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  showNav?: boolean;
};

export function MarketShell({
  children,
  title,
  subtitle,
  backHref = "/",
  backLabel = "Bozorliii.uz",
  showNav = true,
}: Props) {
  return (
    <div className={marketPage}>
      <div className="mx-auto max-w-6xl px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
        <div className={marketGlass}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <Link
                href={backHref}
                className="inline-flex text-xs font-medium text-text-400 transition-colors hover:text-electric-500"
              >
                ← {backLabel}
              </Link>
              <p className={marketEyebrow}>Premium Market</p>
              <h1 className="text-xl font-bold tracking-tight text-ink-900 sm:text-2xl">{title}</h1>
              {subtitle ? <p className="max-w-xl text-sm leading-relaxed text-text-400">{subtitle}</p> : null}
            </div>
          </div>
          {showNav ? (
            <div className="mt-6 border-t border-border-subtle pt-6">
              <MarketNavigation />
            </div>
          ) : null}
        </div>

        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
