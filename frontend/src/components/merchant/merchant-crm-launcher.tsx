"use client";

import { LayoutDashboard, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { openMerchantCrm } from "@/lib/open-merchant-crm";
import { isTelegramWebApp } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";

type MerchantCrmLauncherProps = {
  variant?: "dock" | "card";
  className?: string;
};

/** Sotuvchi uchun CRM — Telegram Web App va profildan. */
export function MerchantCrmLauncher({ variant = "dock", className }: MerchantCrmLauncherProps) {
  const profile = useUserStore((s) => s.profile);
  const inTg = typeof window !== "undefined" && isTelegramWebApp();
  const isMerchant = profile?.role === "merchant";
  const shopId = profile?.shop_id ?? profile?.shop?.id ?? null;
  const shopName = profile?.shop?.name;

  if (variant === "dock" && !inTg) return null;
  if (variant === "card" && !isMerchant) return null;

  const onOpen = () => openMerchantCrm(shopId);

  if (variant === "card") {
    return (
      <section
        className={cn(
          "rounded-2xl border border-gold-500/25 bg-gradient-to-br from-gold-500/10 via-white to-electric-500/5 p-5 shadow-card",
          className,
        )}
      >
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-gold-500/15 p-2.5 text-gold-600">
            <Store className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gold-600">Sotuvchi paneli</p>
            <h3 className="mt-1 text-base font-bold text-ink-900">
              {shopName ? `${shopName} — CRM` : "Merchant CRM"}
            </h3>
            <p className="mt-1 text-sm text-ink-500">
              Buyurtmalar, leadlar, mijoz chat, mahsulot katalogi va bannerlar.
            </p>
            <Button type="button" className="mt-4 w-full sm:w-auto" onClick={onOpen}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              CRM ochish
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 z-[45] px-3 md:hidden",
        "bottom-[calc(var(--app-bottom-nav-h)+env(safe-area-inset-bottom,0px)+3.75rem)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-lg items-center justify-center gap-2",
          "rounded-2xl border border-gold-500/30 bg-gradient-to-r from-gold-500 to-amber-500 px-4 py-3",
          "text-sm font-semibold text-white shadow-gold transition active:scale-[0.98]",
        )}
      >
        <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden />
        {isMerchant && shopName ? `${shopName} — CRM` : "Do'kon egasi — CRM Panel"}
      </button>
    </div>
  );
}
