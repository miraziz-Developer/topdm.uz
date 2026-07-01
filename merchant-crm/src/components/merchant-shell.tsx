"use client";

import { ChevronRight, ExternalLink, LifeBuoy, PanelLeft, Store } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { TelegramCrmBanner } from "@/components/telegram-crm-banner";
import { Button } from "@/components/ui/button";
import { CRM_MAIN_NAV } from "@/lib/crm-nav";
import { getMerchantMe } from "@/lib/api";
import { useMerchantChatInbox } from "@/hooks/useMerchantChatInbox";
import { resolveMediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3002";

const MOBILE_NAV_SHORT: Record<string, string> = {
  "/dashboard": "Bosh",
  "/dashboard/sales": "Savdo",
  "/dashboard/chat": "Chat",
  "/dashboard/products": "Mahsulot",
  "/dashboard/content": "Kontent",
  "/dashboard/shop": "Do'kon",
};

function isNavActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`) || pathname.startsWith(`${href}?`);
}

function resolvePageTitle(pathname: string): string {
  const match = CRM_MAIN_NAV.find((item) => isNavActive(pathname, item.href, item.exact));
  return match?.label ?? "CRM";
}

function NavItem({
  item,
  pathname,
  onNavigate,
  compact = false,
  badge,
}: {
  item: (typeof CRM_MAIN_NAV)[number];
  pathname: string;
  onNavigate?: () => void;
  compact?: boolean;
  badge?: number;
}) {
  const active = isNavActive(pathname, item.href, item.exact);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={item.description}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        active
          ? "crm-nav-active text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon
        className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/60 group-hover:text-sidebar-foreground")}
      />
      {!compact ? (
        <span className="truncate">{item.label}</span>
      ) : (
        <span className="sr-only">{item.label}</span>
      )}
      {badge && badge > 0 ? (
        <span className="ml-auto inline-flex min-w-[1.125rem] items-center justify-center rounded-full bg-sidebar-primary px-1.5 py-0.5 text-[10px] font-bold text-sidebar-primary-foreground">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : active && !compact ? (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" aria-hidden />
      ) : null}
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
  const { totalUnread: chatUnread } = useMerchantChatInbox();
  const [shopName, setShopName] = useState<string>("Do'kon");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const pageTitle = useMemo(() => resolvePageTitle(pathname), [pathname]);

  useEffect(() => {
    void getMerchantMe()
      .then((me) => {
        setShopName(me.shop?.name || "Do'kon");
        setShopLogoUrl(me.shop?.logo_url ?? null);
      })
      .catch(() => undefined);

    const onUpdate = (event: Event) => {
      const detail = (event as CustomEvent<Partial<{ name: string; logo_url: string | null }>>).detail;
      if (detail?.name) setShopName(detail.name);
      if (detail?.logo_url !== undefined) setShopLogoUrl(detail.logo_url);
    };
    window.addEventListener("merchant-shop-updated", onUpdate);
    return () => window.removeEventListener("merchant-shop-updated", onUpdate);
  }, []);

  const logoSrc = resolveMediaUrl(shopLogoUrl);

  return (
    <div className="crm-app-bg flex min-h-screen">
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] flex-col border-r border-sidebar-border text-sidebar-foreground lg:flex"
        style={{
          background:
            "linear-gradient(180deg, hsl(228 32% 7%) 0%, hsl(248 40% 10%) 45%, hsl(228 32% 8%) 100%)",
        }}
        aria-label="CRM navigatsiya"
      >
        <div className="flex h-[var(--header-height)] items-center border-b border-white/5 px-5">
          <BozorliiiLogo variant="icon" size="sm" href="/dashboard" badge="CRM" theme="dark" />
        </div>

        <div className="border-b border-white/5 px-4 py-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/5 px-3 py-2.5 backdrop-blur-sm">
            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/15">
              {logoSrc ? (
                <Image src={logoSrc} alt="" fill className="object-cover" unoptimized sizes="36px" />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Store className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{shopName}</p>
              <p className="text-[11px] text-sidebar-foreground/55">Sotuvchi panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-sidebar-foreground/45">
            Menyu
          </p>
          {CRM_MAIN_NAV.map((item) => (
            <NavItem
              key={item.href}
              item={item}
              pathname={pathname}
              badge={item.href === "/dashboard/chat" ? chatUnread : undefined}
            />
          ))}
        </nav>

        <div className="space-y-2 border-t border-sidebar-border p-4">
          <Link
            href="/dashboard/support"
            className={cn(
              "flex items-center justify-center gap-2 rounded-md border border-sidebar-border px-3 py-2 text-xs font-medium transition",
              pathname === "/dashboard/support" || pathname.startsWith("/dashboard/support/")
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "bg-sidebar-accent/40 text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            Qo&apos;llab-quvvatlash
          </Link>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs font-medium text-sidebar-foreground/80 transition hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Bozorliii sayti
            <ExternalLink className="h-3 w-3" />
          </a>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            onClick={onSignOut}
          >
            Chiqish
          </Button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-[var(--sidebar-width)]">
        <header className="crm-glass-header sticky top-0 z-30 flex h-[var(--header-height)] items-center gap-3 px-4 sm:px-6">
          <PanelLeft className="hidden h-4 w-4 text-muted-foreground lg:block" aria-hidden />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/dashboard" className="hidden font-medium transition hover:text-foreground sm:inline">
              CRM
            </Link>
            <ChevronRight className="hidden h-3.5 w-3.5 sm:block" aria-hidden />
            <span className="truncate font-semibold text-foreground">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-2 lg:hidden">
            <BozorliiiLogo variant="icon" size="sm" href="/dashboard" />
          </div>
          <a
            href={SITE_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-primary transition hover:bg-accent sm:inline-flex"
          >
            Sayt
            <ExternalLink className="h-3 w-3" />
          </a>
          <Link
            href="/dashboard/support"
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground sm:hidden"
          >
            <LifeBuoy className="h-3.5 w-3.5" />
            Yordam
          </Link>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={onSignOut}>
            Chiqish
          </Button>
        </header>

        <main className="flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:pb-6 pb-24">
          <TelegramCrmBanner />
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/60 bg-card/90 backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-lg justify-between px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1">
          {CRM_MAIN_NAV.map((item) => {
            const active = isNavActive(pathname, item.href, item.exact);
            const Icon = item.icon;
            const badge = item.href === "/dashboard/chat" ? chatUnread : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl px-0.5 py-2 text-[10px] font-semibold transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-xl transition",
                    active && "bg-primary/12 shadow-glow",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {badge > 0 ? (
                    <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-[0.875rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="max-w-[4.5rem] truncate">{MOBILE_NAV_SHORT[item.href] ?? item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
