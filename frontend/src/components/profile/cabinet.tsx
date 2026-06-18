"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Edit2,
  LogOut,
  Package,
  Phone,
  Search,
  Settings2,
  Sparkles,
  Store,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MerchantCrmLauncher } from "@/components/merchant/merchant-crm-launcher";
import { LiveOrders } from "@/components/profile/live-orders";
import { ProfileAvatarUpload } from "@/components/profile/profile-avatar-upload";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { getMyOrders, lookupOrdersByPhone, patchAuthMePhone } from "@/lib/api";
import { filterOrdersByScope, sortOrdersNewestFirst } from "@/lib/order-filters";
import { readGuestLookupToken, readGuestPhone } from "@/lib/guest-phone";
import { allowDevMocks } from "@/lib/runtime-flags";
import { ApiError } from "@/lib/http-client";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/user-store";
import type { AuthMeResponse, Order } from "@/types";

const STYLIST_PREFS_KEY = "bozor_ai_cabinet_stylist_prefs";

type StylistPrefs = {
  size: string;
  style: string;
  sector: "retail" | "wholesale";
};

const DEFAULT_PREFS: StylistPrefs = {
  size: "M",
  style: "minimal",
  sector: "retail",
};

const SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: "XS", label: "XS — kompakt" },
  { value: "S", label: "S — slim fit" },
  { value: "M", label: "M — standart" },
  { value: "L", label: "L — relaxed" },
  { value: "XL", label: "XL — oversize" },
];

const STYLE_OPTIONS: { value: string; label: string }[] = [
  { value: "sport", label: "Sport / athleisure" },
  { value: "minimal", label: "Minimal klassik" },
  { value: "street", label: "Streetwear / casual" },
  { value: "business", label: "Biznes smart" },
];

const SECTOR_OPTIONS: { value: StylistPrefs["sector"]; label: string }[] = [
  { value: "retail", label: "Chakana (dona-dona)" },
  { value: "wholesale", label: "Ulgurji (seriya)" },
];

const UZ_PHONE_CANONICAL = /^\+998\d{9}$/;

/** Backend: +998 + 9 digits */
function normalizeUzPhoneInput(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let core = digits;
  if (core.startsWith("998") && core.length >= 12) {
    core = core.slice(0, 12);
  } else if (core.length === 9) {
    core = `998${core}`;
  } else {
    return null;
  }
  if (core.length !== 12 || !core.startsWith("998")) return null;
  return `+${core}`;
}

function formatUzPhoneDisplay(canonical: string | null | undefined): string {
  if (!canonical?.trim()) return "";
  if (!UZ_PHONE_CANONICAL.test(canonical.trim())) return canonical.trim();
  const nine = canonical.trim().slice(4);
  return `+998 (${nine.slice(0, 2)}) ${nine.slice(2, 5)}-${nine.slice(5, 7)}-${nine.slice(7, 9)}`;
}

function tierLabel(coins: number): string {
  if (coins >= 150) return "Noir Elite";
  if (coins >= 25) return "Platinum Club";
  if (coins >= 10) return "Gold Atelier";
  if (coins >= 1) return "Silver Select";
  return "Bronze Bazaar";
}

function selectClassName() {
  return cn(
    "mt-2 w-full cursor-pointer rounded-xl border border-border-subtle bg-white/80 px-3 py-2.5",
    "text-sm font-semibold text-ink-900 shadow-sm outline-none transition",
    "focus:border-electric-500/40 focus:ring-2 focus:ring-electric-500/15",
    "backdrop-blur-sm",
  );
}

export type PremiumCabinetProps = {
  profile: AuthMeResponse;
  coins: number;
  onLogout: () => void | Promise<void>;
};

export function PremiumCabinet({ profile, coins, onLogout }: PremiumCabinetProps) {
  const { push } = useToast();
  const refreshProfile = useUserStore((s) => s.refresh);
  const [prefs, setPrefs] = useState<StylistPrefs>(DEFAULT_PREFS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneEditBuffer, setPhoneEditBuffer] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);

  const displayName =
    profile.display_name?.trim() ||
    profile.email ||
    (profile.telegram_id ? `Telegram · ${profile.telegram_id}` : "Foydalanuvchi");

  const roleUz = profile.role === "merchant" ? "Sotuvchi" : "Xaridor";
  const showDemoCoins = allowDevMocks();
  const tier = tierLabel(coins);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STYLIST_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StylistPrefs>;
        setPrefs({ ...DEFAULT_PREFS, ...parsed });
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistPrefs = useCallback((next: StylistPrefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(STYLIST_PREFS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const hasPhone = Boolean(profile.phone?.trim());
        const mine = await getMyOrders("active");
        let items = sortOrdersNewestFirst(mine.items ?? []);
        const savedPhone = readGuestPhone();
        if (savedPhone && UZ_PHONE_CANONICAL.test(savedPhone)) {
          const token = readGuestLookupToken(savedPhone);
          if (token) {
            try {
              const guest = await lookupOrdersByPhone(savedPhone, token);
              const guestActive = filterOrdersByScope(guest.items ?? [], "active");
              const byId = new Map<string, Order>();
              for (const o of items) byId.set(o.id, o);
              for (const o of guestActive) byId.set(o.id, o);
              items = sortOrdersNewestFirst(Array.from(byId.values()));
            } catch {
              // ignore fallback errors
            }
          }
        }
        if (!cancelled) setOrders(items.slice(0, 3));
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setOrdersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.phone, profile.role]);

  const shortId = useMemo(() => {
    const raw = profile.id.replace(/-/g, "").slice(0, 8).toUpperCase();
    return `BA-${raw}`;
  }, [profile.id]);

  const phoneDisplay = useMemo(
    () => (profile.phone ? formatUzPhoneDisplay(profile.phone) : ""),
    [profile.phone],
  );

  const beginEditPhone = useCallback(() => {
    setPhoneEditBuffer(profile.phone ? formatUzPhoneDisplay(profile.phone) : "+998 ");
    setIsEditingPhone(true);
  }, [profile.phone]);

  const cancelEditPhone = useCallback(() => {
    setPhoneEditBuffer(profile.phone ? formatUzPhoneDisplay(profile.phone) : "");
    setIsEditingPhone(false);
  }, [profile.phone]);

  const savePhone = useCallback(async () => {
    const canonical = normalizeUzPhoneInput(phoneEditBuffer);
    if (!canonical) {
      push("+998 dan keyin 9 raqam kiriting (masalan +998901234567)", "error");
      return;
    }
    setPhoneSaving(true);
    try {
      await patchAuthMePhone(canonical);
      await refreshProfile();
      push("Telefon yangilandi", "success");
      setIsEditingPhone(false);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Saqlab bo'lmadi";
      push(msg, "error");
    } finally {
      setPhoneSaving(false);
    }
  }, [phoneEditBuffer, push, refreshProfile]);

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-x-0 -top-8 h-72 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(0,102,255,0.16),transparent_58%),radial-gradient(ellipse_45%_40%_at_100%_0%,rgba(255,77,18,0.08),transparent_50%)]" />

      <header className="relative border-b border-border-subtle/80 pb-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-electric-500">Hisob</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink-900 md:text-[2rem]">Shaxsiy kabinet</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-500">
            Bozorliii.uz profilingiz, Bozor Coin va AI Stilist uchun shaxsiy sozlamalar — barchasi bir panelda.
          </p>
        </motion.div>
      </header>

      <MerchantCrmLauncher variant="card" className="relative mt-8" />

      <div className="relative mx-auto mt-10 grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: coin card + identity */}
        <div className="space-y-6 lg:col-span-4">
          {showDemoCoins ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-gradient-to-br from-[#0a0a0f] via-[#12121a] to-[#050508] p-6 text-white shadow-elevated"
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-electric-500/25 blur-3xl transition duration-500 group-hover:bg-electric-400/30" />
            <div className="pointer-events-none absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-neon-500/15 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">Mavjud balans</p>
                <p className="price-mono mt-2 text-4xl font-bold tracking-tight md:text-[2.75rem]">
                  {coins}
                  <span className="ml-2 text-lg font-medium text-white/50">Coin</span>
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-md">
                {tier}
              </span>
            </div>
            <div className="relative mt-12 flex items-center justify-between border-t border-white/10 pt-5">
              <span className="price-mono text-[10px] tracking-[0.18em] text-white/40">BOZORLIII PASS</span>
              <Link
                href="/checkout"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/12 px-3 py-2 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/18"
              >
                Savatcha
                <ArrowRight className="h-3.5 w-3.5 opacity-80" aria-hidden />
              </Link>
            </div>
          </motion.div>
          ) : null}

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: showDemoCoins ? 0.1 : 0.05 }}
            className="glass-panel-strong rounded-[1.75rem] p-6 ring-1 ring-black/[0.04]"
          >
            <div className="flex items-center gap-4">
              <ProfileAvatarUpload userId={profile.id} displayName={displayName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{displayName}</p>
                <p className="mt-0.5 text-xs text-ink-500">{roleUz} profili</p>
              </div>
            </div>
            <dl className="mt-5 space-y-4 border-t border-border-subtle pt-5 text-xs">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt className="shrink-0 text-ink-500">Email</dt>
                <dd className="min-w-0 truncate text-right font-medium tracking-tight text-ink-900 sm:max-w-[65%]">
                  {profile.email ?? "—"}
                </dd>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <dt className="flex shrink-0 items-center gap-1.5 text-ink-500">
                  <Phone className="h-3.5 w-3.5 text-ink-400" aria-hidden />
                  Telefon
                </dt>
                <dd className="min-h-[36px] min-w-0 sm:flex sm:justify-end">
                  {isEditingPhone ? (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"
                    >
                      <input
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        value={phoneEditBuffer}
                        onChange={(e) => setPhoneEditBuffer(e.target.value)}
                        placeholder="+998 (__) ___-__-__"
                        disabled={phoneSaving}
                        className={cn(
                          "price-mono min-w-0 flex-1 rounded-xl border border-border-subtle bg-elevated/60 px-3 py-2",
                          "text-[11px] font-medium tracking-wide text-ink-900 shadow-inner outline-none transition",
                          "placeholder:text-ink-400 focus:border-electric-500/45 focus:ring-2 focus:ring-electric-500/15 sm:w-44 sm:flex-none",
                        )}
                      />
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Saqlash"
                          disabled={phoneSaving}
                          onClick={() => void savePhone()}
                          className={cn(
                            "rounded-lg border border-green/25 bg-green/8 p-2 text-green transition",
                            "hover:bg-green/15 disabled:opacity-50",
                          )}
                        >
                          <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                        </button>
                        <button
                          type="button"
                          aria-label="Bekor qilish"
                          disabled={phoneSaving}
                          onClick={cancelEditPhone}
                          className={cn(
                            "rounded-lg border border-red/20 bg-red/6 p-2 text-red transition",
                            "hover:bg-red/12 disabled:opacity-50",
                          )}
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <button
                      type="button"
                      onClick={beginEditPhone}
                      className="group flex w-full items-center justify-end gap-2 rounded-xl py-0.5 text-right transition sm:w-auto"
                    >
                      <span className="price-mono text-[11px] font-semibold tracking-wide text-ink-900">
                        {phoneDisplay || "Kiritilmagan"}
                      </span>
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-ink-300 transition group-hover:border-electric-500/20 group-hover:bg-electric-500/8 group-hover:text-electric-600">
                        <Edit2 className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    </button>
                  )}
                </dd>
              </div>

              <div className="flex justify-between gap-3 pt-1">
                <dt className="text-ink-500">Tizim ID</dt>
                <dd className="price-mono text-ink-700">#{shortId}</dd>
              </div>
            </dl>
          </motion.div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <Link
              href="/search"
              className="glass-panel group flex items-center gap-3 rounded-2xl p-4 ring-1 ring-border-subtle transition hover:-translate-y-0.5 hover:shadow-hover"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-electric-500/10 text-electric-500">
                <Search className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-900">AI qidiruv</p>
                <p className="text-xs text-ink-500">Look va mahsulotlar</p>
              </div>
              <ChevronRight className="ml-auto h-4 w-4 text-ink-400 transition group-hover:translate-x-0.5" />
            </Link>
            {profile.shop?.slug ? (
              <Link
                href={`/shop/${profile.shop.slug}`}
                className="glass-panel group flex items-center gap-3 rounded-2xl p-4 ring-1 ring-border-subtle transition hover:-translate-y-0.5 hover:shadow-hover"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-neon-500/10 text-neon-500">
                  <Store className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">Do&apos;konim</p>
                  <p className="truncate text-xs text-ink-500">{profile.shop.name}</p>
                </div>
                <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-ink-400" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Right: AI stylist + orders */}
        <div className="space-y-6 lg:col-span-8">
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="relative overflow-hidden rounded-[1.75rem] glass-panel-strong p-6 md:p-8 ring-1 ring-black/[0.04] shadow-card"
          >
            <Sparkles
              className="pointer-events-none absolute -right-4 -top-4 h-36 w-36 text-electric-500/[0.07]"
              aria-hidden
            />
            <div className="relative flex flex-wrap items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-electric-500/12 text-electric-500">
                <Sparkles className="h-4 w-4" aria-hidden />
              </div>
              <h2 className="text-lg font-bold tracking-tight text-ink-900">AI Stilist metrikalari</h2>
            </div>
            <p className="relative mt-2 max-w-xl text-xs leading-relaxed text-ink-500">
              Qidiruv va tavsiyalar shu afzalliklarga moslashadi. Tanlovlar brauzeringizda saqlanadi.
            </p>

            <div className="relative mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <label className="rounded-2xl border border-border-subtle bg-elevated/50 p-4 backdrop-blur-sm">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-500">
                  <Settings2 className="h-3 w-3" aria-hidden />
                  O&apos;lcham
                </span>
                <select
                  className={selectClassName()}
                  value={prefs.size}
                  onChange={(e) => persistPrefs({ ...prefs, size: e.target.value })}
                >
                  {SIZE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rounded-2xl border border-border-subtle bg-elevated/50 p-4 backdrop-blur-sm">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Uslub</span>
                <select
                  className={selectClassName()}
                  value={prefs.style}
                  onChange={(e) => persistPrefs({ ...prefs, style: e.target.value })}
                >
                  {STYLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="rounded-2xl border border-border-subtle bg-elevated/50 p-4 backdrop-blur-sm sm:col-span-2 lg:col-span-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-500">Bozor sektori</span>
                <select
                  className={selectClassName()}
                  value={prefs.sector}
                  onChange={(e) => persistPrefs({ ...prefs, sector: e.target.value as StylistPrefs["sector"] })}
                >
                  {SECTOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.12 }}
            className="rounded-[1.75rem] glass-panel-strong p-6 md:p-8 ring-1 ring-black/[0.04] shadow-card"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-900/5">
                  <Package className="h-4 w-4 text-ink-700" aria-hidden />
                </div>
                <h2 className="text-lg font-bold tracking-tight text-ink-900">Jonli buyurtmalar</h2>
              </div>
              <Link
                href="/orders"
                className="inline-flex items-center gap-0.5 text-xs font-semibold text-electric-600 transition hover:text-electric-500"
              >
                Barchasi
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>

            <div className="mt-6 space-y-4">
              <LiveOrders
                orders={orders}
                loading={ordersLoading}
                variant={profile.role === "merchant" ? "merchant" : "buyer"}
                hasPhone={Boolean(profile.phone?.trim())}
                onAddPhone={beginEditPhone}
              />
            </div>
          </motion.section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-2">
            <p className="text-[11px] text-ink-400">Bozorliii.uz · xavfsiz hisob</p>
            <Button
              variant="ghost"
              className="text-ink-500 hover:text-red"
              leftIcon={<LogOut className="h-4 w-4" />}
              onClick={() => void onLogout()}
            >
              Chiqish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
