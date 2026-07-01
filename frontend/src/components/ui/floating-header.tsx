"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, Shirt, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { OrderNotificationsBell } from "@/components/notifications/order-notifications-bell";
import { LocaleCurrencyNav } from "@/components/ui/locale-currency-bar";
import { SearchField } from "@/components/ui/search-field";
import { usePhotoSearchNavigate } from "@/hooks/usePhotoSearchNavigate";
import { useVoiceSearch } from "@/hooks/useVoiceSearch";
import { clearStoredPhotoSearch } from "@/lib/photoSearch";
import { useCartStore } from "@/stores/cart-store";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";
import { cn } from "@/lib/utils";

export function FloatingHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const isSearchPage = pathname === "/search";
  const isPhotoMode = isSearchPage && searchParams.get("photo") === "1";
  const isAuthPage = pathname.startsWith("/auth");
  const isReelsPage = pathname.startsWith("/reels");
  const [mounted, setMounted] = useState(false);
  const { runPhotoSearch, isSearching } = usePhotoSearchNavigate();
  const { listening, startListening } = useVoiceSearch((transcript) => {
    setQuery(transcript);
    clearStoredPhotoSearch();
    router.push(`/search?q=${encodeURIComponent(transcript)}`);
  });
  const cartItems = useCartStore((state) => state.totalItems());
  const profile = useUserStore((state) => state.profile);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const totalItems = mounted ? cartItems : 0;
  const coins = mounted && isLoggedIn ? (profile?.coins_balance ?? 0) : 0;

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!isSearchPage) return;
    if (isPhotoMode) { setQuery(""); return; }
    setQuery(searchParams.get("q") ?? "");
  }, [isPhotoMode, isSearchPage, searchParams]);

  const submit = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    clearStoredPhotoSearch();
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const clearSearch = () => {
    setQuery("");
    clearStoredPhotoSearch();
    router.replace("/search");
  };

  // Reels page: fully hidden header (full-screen experience)
  if (isReelsPage) return null;

  // Auth pages: minimal header
  if (isAuthPage) {
    return (
      <header className="safe-top fixed inset-x-0 top-0 z-50 h-14 border-b border-border-subtle bg-white/95 backdrop-blur-md sm:h-16">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6">
          <BozorliiiLogo variant="full" size="sm" href="/" />
          <Link
            href="/"
            className="rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:text-electric-500"
          >
            Bosh sahifa
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      className={cn(
        "safe-top fixed inset-x-0 top-0 z-50 h-14 transition-all duration-200 sm:h-16",
        scrolled
          ? "border-b border-white/60 bg-white/92 shadow-[0_8px_32px_-12px_rgba(3,3,8,0.12)] backdrop-blur-2xl backdrop-saturate-150"
          : "bg-white/80 backdrop-blur-xl backdrop-saturate-150",
      )}
    >
      {/* Single-row flex — never wraps */}
      <div className="mx-auto flex h-full max-w-7xl flex-nowrap items-center gap-2 px-3 sm:gap-3 sm:px-4 lg:gap-4 lg:px-6">

        {/* Logo — fixed width, never shrinks */}
        <div className="shrink-0">
          <BozorliiiLogo variant="full" size="sm" href="/" className="hidden min-[480px]:block" />
          <BozorliiiLogo variant="icon" size="sm" href="/" className="min-[480px]:hidden" />
        </div>

        {/* Search — takes all remaining space */}
        <div className="min-w-0 flex-1">
          <SearchField
            variant="pill"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onSubmit={submit}
            onVoice={startListening}
            listening={listening}
            busy={isSearching}
            onPhotoFile={(file) => { void runPhotoSearch(file); }}
            placeholder={isPhotoMode ? "Rasm qidiruv" : "AI qidiruv…"}
            className="w-full"
            showPhotoButton
            showVoiceButton
            rightSlot={
              isSearchPage && (query.trim() || isPhotoMode) ? (
                <button type="button" onClick={clearSearch} className="px-2 text-sm text-text-400 hover:text-text-100">
                  ×
                </button>
              ) : undefined
            }
          />
        </div>

        {/* Right actions — fixed, no-wrap */}
        <div className="flex shrink-0 items-center gap-1">
          <LocaleCurrencyNav className="hidden lg:flex" />

          <OrderNotificationsBell />

          <Link
            href="/stylist"
            className="hidden shrink-0 rounded-full border border-electric-500/25 bg-electric-500/8 p-2 text-electric-600 transition hover:bg-electric-500/15 xl:flex"
            aria-label="AI Stilist"
          >
            <Shirt className="h-4 w-4" />
          </Link>

          <Link
            href="/profile"
            className="hidden shrink-0 rounded-full border border-border-default px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:text-electric-500 xl:flex"
          >
            {coins} Coin
          </Link>

          <Link
            href="/profile"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-default text-ink-700 transition hover:border-electric-500/40 hover:text-electric-500"
          >
            <UserRound className="h-[1.1rem] w-[1.1rem]" />
          </Link>

          <Link
            href="/checkout"
            data-cart-anchor
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-default text-ink-700 transition hover:border-neon-500/40"
          >
            <ShoppingBag className="h-[1.1rem] w-[1.1rem]" />
            <AnimatePresence>
              {totalItems > 0 ? (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-500 px-1 text-[9px] font-bold text-white"
                >
                  {totalItems}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </Link>
        </div>
      </div>
    </header>
  );
}
