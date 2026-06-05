"use client";

import { ExternalLink, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { TelegramCrmBanner } from "@/components/telegram-crm-banner";
import { Button } from "@/components/ui/button";
import { CRM_MAIN_NAV } from "@/lib/crm-nav";
import { getMerchantMe } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
}

function NavItem({
  item,
  pathname,
  onNavigate,
}: {
  item: (typeof CRM_MAIN_NAV)[number];
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isNavActive(pathname, item.href, item.exact);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.description}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200",
        active ? "bg-electric-500/[0.08] ring-1 ring-electric-500/15" : "hover:bg-elevated/60",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
          active ? "bg-electric-500 text-white shadow-md" : "bg-canvas text-text-400 group-hover:text-electric-500",
        )}
      >
        <Icon className="h-[1.125rem] w-[1.125rem]" />
      </span>
      <span className="min-w-0">
        <span className={cn("block text-sm font-semibold leading-tight", active ? "text-text-100" : "text-text-300")}>
          {item.label}
        </span>
        {active ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-text-400">{item.description}</span>
        ) : null}
      </span>
    </Link>
  );
}

export function MerchantShell({
  children,
  onSignOut,
}: {
  children: React.ReactNode;
  onSignOut: () => void;
}) {
  const pathname = usePathname();
  const [shopName, setShopName] = useState<string>("Do'kon");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  useEffect(() => {
    void getMerchantMe()
      .then((me) => {
        setShopName(me.shop?.name || "Do'kon");
        setShopLogoUrl(me.shop?.logo_url ?? null);
      })
      .catch(() => undefined);
  }, []);
  const logoSrc = resolveMediaUrl(shopLogoUrl);

  return (
    <div className="min-h-screen bg-canvas crm-mesh-bg">
      <header className="sticky top-0 z-50 border-b border-border-subtle/70 bg-surface/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
          <div className="flex items-center gap-3">
            <BozorliiiLogo variant="full" size="sm" href="/dashboard" badge="CRM" />
          </div>
          <div className="flex items-center gap-2">
            <a
              href={SITE_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-electric-600 transition hover:border-electric-500/25 hover:bg-electric-500/5 sm:inline-flex"
            >
              Sayt
              <ExternalLink className="h-3 w-3" />
            </a>
            <Button variant="ghost" size="sm" onClick={onSignOut}>
              Chiqish
            </Button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex max-w-6xl gap-5 px-4 py-5 lg:px-6 lg:py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-[3.75rem] space-y-3">
            <div className="crm-surface-card flex items-center gap-3 p-3.5">
              <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-electric-500 text-white shadow-md">
                {logoSrc ? (
                  <Image src={logoSrc} alt="" fill className="object-cover" unoptimized sizes="40px" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Store className="h-5 w-5" />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-text-100">{shopName}</p>
                <p className="text-[11px] text-text-400">Sotuvchi panel</p>
              </div>
            </div>

            <nav className="crm-surface-card flex flex-col gap-0.5 p-1.5">
              {CRM_MAIN_NAV.map((item) => (
                <NavItem key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-6">
          <TelegramCrmBanner />
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border-subtle/80 bg-surface/95 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg justify-between">
          {CRM_MAIN_NAV.map((item) => {
            const active = isNavActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 text-[10px] font-semibold",
                  active ? "text-electric-600" : "text-text-400",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    active && "bg-electric-500/12",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate max-w-[4.5rem]">{item.label.split(" ")[0]}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
