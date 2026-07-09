"use client";

import {
  ChevronRight,
  ExternalLink,
  LogOut,
  Menu,
  PanelLeftClose,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { AdminMobileNav } from "@/components/admin-mobile-nav";
import { ADMIN_NAV, resolvePageTitle } from "@/lib/admin-nav";
import { cn } from "@/lib/utils";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bozorliii.online";

function NavLink({
  item,
  pathname,
  onNavigate,
}: {
  item: (typeof ADMIN_NAV)[number];
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
        active
          ? "bg-sidebar-primary/15 text-sidebar-primary"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-sidebar-primary" : "opacity-70")} />
      <span className="truncate">{item.label}</span>
      {active ? <ChevronRight className="ml-auto h-3.5 w-3.5 opacity-60" /> : null}
    </Link>
  );
}

export function AdminShell({
  children,
  username,
}: {
  children: React.ReactNode;
  username?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const title = resolvePageTitle(pathname);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="border-b border-sidebar-border px-4 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar-primary/20 text-sidebar-primary">
            <Shield className="h-5 w-5" />
          </div>
          {!collapsed ? (
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">Bozorliii</p>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Platform Admin</p>
            </div>
          ) : null}
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {ADMIN_NAV.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
        ))}
      </nav>
      <div className="border-t border-sidebar-border p-3 space-y-2">
        <a
          href={SITE_URL}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          {!collapsed ? "Saytni ochish" : null}
        </a>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={() => void signOut()}>
          <LogOut className="h-4 w-4" />
          {!collapsed ? "Chiqish" : null}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-dvh">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-sidebar-border bg-sidebar lg:block transition-all",
          collapsed ? "w-[72px]" : "w-64",
          mobileOpen && "!block w-64",
        )}
      >
        {sidebar}
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Menyuni yopish"
        />
      ) : null}

      <div className={cn("flex min-h-dvh flex-1 flex-col transition-all", collapsed ? "lg:pl-[72px]" : "lg:pl-64")}>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/80 bg-background/80 px-4 backdrop-blur-xl lg:px-6" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          <button
            type="button"
            className="rounded-lg p-2 text-muted-foreground hover:bg-accent lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="hidden rounded-lg p-2 text-muted-foreground hover:bg-accent lg:inline-flex"
            onClick={() => setCollapsed((v) => !v)}
          >
            <PanelLeftClose className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold sm:text-lg">{title}</h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Platforma biznes boshqaruvi {username ? `· ${username}` : ""}
            </p>
          </div>
        </header>
        <main className="admin-mobile-nav flex-1 p-3 sm:p-4 lg:p-6">{children}</main>
        <AdminMobileNav onOpenMenu={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}
