"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { useEffect, useState } from "react";

import { OrderFlowCard } from "@/components/profile/live-orders";
import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  getMyOrders,
  lookupOrdersByPhone,
  sendOrderLookupOtp,
  verifyOrderLookupOtp,
} from "@/lib/api";
import {
  filterOrdersByScope,
  sortOrdersNewestFirst,
  type OrderListScope,
} from "@/lib/order-filters";
import {
  readGuestLookupToken,
  readGuestPhone,
  saveGuestLookupToken,
  saveGuestPhone,
} from "@/lib/guest-phone";
import { ApiError } from "@/lib/http-client";
import {
  applyPhoneMaskInput,
  formatUzbekPhoneParenDisplay,
  normalizeUzbekPhoneE164,
  UZ_PHONE_E164_REGEX,
} from "@/utils/phone-mask";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";
import type { Order } from "@/types";

export default function OrdersPage() {
  const { push } = useToast();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const userHydrated = useUserStore((state) => state.hydrated);
  const profile = useUserStore((state) => state.profile);

  const [orders, setOrders] = useState<Order[]>([]);
  const [scope, setScope] = useState<OrderListScope>("active");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestPhone, setGuestPhone] = useState(() => {
    const saved = readGuestPhone();
    return saved ? formatUzbekPhoneParenDisplay(saved) : "+998 ";
  });
  const [guestLoading, setGuestLoading] = useState(false);
  const [otpStep, setOtpStep] = useState<"phone" | "code">("phone");
  const [otpCode, setOtpCode] = useState("");

  useEffect(() => {
    if (!authHydrated || !userHydrated) return;

    if (isLoggedIn) {
      void (async () => {
        try {
          const mine = await getMyOrders("all");
          let items = sortOrdersNewestFirst(mine.items ?? []);
          const saved = readGuestPhone();
          if (saved && UZ_PHONE_E164_REGEX.test(saved)) {
            const token = readGuestLookupToken(saved);
            if (token) {
              try {
                const guest = await lookupOrdersByPhone(saved, token);
                const byId = new Map<string, Order>();
                for (const o of items) byId.set(o.id, o);
                for (const o of guest.items ?? []) byId.set(o.id, o);
                items = Array.from(byId.values());
              } catch {
                // ignore guest fallback errors for logged-in flow
              }
            }
          }
          setOrders(items);
          if (!items.length) {
            setError(
              profile?.phone
                ? "Buyurtma topilmadi. Checkout telefoni profil telefoni bilan bir xil ekanini tekshiring."
                : "Profilga telefon qo'shing — buyurtmalar shu raqam bilan bog'lanadi.",
            );
          } else {
            setError(null);
          }
        } catch {
          setError("Buyurtmalarni yuklab bo'lmadi.");
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    const saved = readGuestPhone();
    const savedToken = saved ? readGuestLookupToken(saved) : null;
    if (saved && UZ_PHONE_E164_REGEX.test(saved) && savedToken) {
      setGuestLoading(true);
      void lookupOrdersByPhone(saved, savedToken)
        .then((response) => {
          setOrders(response.items);
          setError(response.items.length ? null : "Bu telefon uchun buyurtma topilmadi.");
        })
        .catch(() => {
          setOrders([]);
          setError("Sessiya tugagan. SMS kod bilan qayta tasdiqlang.");
          setOtpStep("phone");
        })
        .finally(() => {
          setGuestLoading(false);
          setLoading(false);
        });
      return;
    }

    setLoading(false);
    setError(null);
  }, [authHydrated, userHydrated, isLoggedIn, profile?.phone]);

  const scopedOrders = filterOrdersByScope(orders, scope);

  const scopeTabs: { key: OrderListScope; label: string }[] = [
    { key: "active", label: "Faol" },
    { key: "completed", label: "Yakunlangan" },
    { key: "cancelled", label: "Bekor" },
    { key: "all", label: "Barchasi" },
  ];

  const sendOtp = async () => {
    const phoneE164 = normalizeUzbekPhoneE164(guestPhone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      push("Telefon raqamini to'g'ri kiriting", "error");
      return;
    }
    setGuestLoading(true);
    setError(null);
    try {
      saveGuestPhone(phoneE164);
      const result = await sendOrderLookupOtp(phoneE164);
      if (result.dev_otp) {
        push(`Dev OTP: ${result.dev_otp}`, "info");
      } else {
        push("SMS kod yuborildi", "success");
      }
      setOtpStep("code");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "SMS yuborilmadi";
      setError(message);
      push(message, "error");
    } finally {
      setGuestLoading(false);
    }
  };

  const confirmOtpAndLookup = async () => {
    const phoneE164 = normalizeUzbekPhoneE164(guestPhone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      push("Telefon raqamini to'g'ri kiriting", "error");
      return;
    }
    if (!otpCode.trim()) {
      push("SMS kodini kiriting", "error");
      return;
    }
    setGuestLoading(true);
    setError(null);
    try {
      const verified = await verifyOrderLookupOtp(phoneE164, otpCode.trim());
      saveGuestLookupToken(phoneE164, verified.verification_token);
      const response = await lookupOrdersByPhone(phoneE164, verified.verification_token);
      setOrders(response.items);
      if (!response.items.length) {
        setError("Bu telefon uchun buyurtma topilmadi.");
      }
    } catch (err) {
      setOrders([]);
      const message = err instanceof ApiError ? err.message : "Qidiruv muvaffaqiyatsiz";
      setError(message);
      push(message, "error");
    } finally {
      setGuestLoading(false);
    }
  };

  const showGuestForm = !isLoggedIn && authHydrated && userHydrated;
  const listLoading = loading || guestLoading;
  const guestPhoneE164 = normalizeUzbekPhoneE164(guestPhone);
  const guestVerificationToken =
    !isLoggedIn && UZ_PHONE_E164_REGEX.test(guestPhoneE164)
      ? readGuestLookupToken(guestPhoneE164) ?? undefined
      : undefined;

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-3xl px-4 pb-8 sm:px-5">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-electric-500">Jonli kuzatuv</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-text-100">Buyurtmalarim</h1>
        <p className="mb-6 text-sm text-text-400">
          {isLoggedIn
            ? "Profil telefon raqamingiz va hisob bo'yicha barcha bronlar."
            : "Telefon raqamingiz bilan bronlarni ko'ring yoki tizimga kiring."}
        </p>

        {isLoggedIn && orders.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-2">
            {scopeTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setScope(tab.key)}
                className={cn(
                  "rounded-full px-4 py-2 text-xs font-semibold transition",
                  scope === tab.key
                    ? "bg-electric-500 text-white shadow-sm"
                    : "border border-border-subtle bg-surface text-text-400 hover:text-text-200",
                )}
              >
                {tab.label}
                <span className="ml-1.5 opacity-70">
                  ({filterOrdersByScope(orders, tab.key).length})
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {showGuestForm ? (
          <div className="mb-6 rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="mb-3 text-sm text-text-300">
              Mehmon sifatida bron qilgan bo&apos;lsangiz, checkoutda kiritgan telefonni qidiring.
            </p>
            {otpStep === "phone" ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Telefon"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(applyPhoneMaskInput(e.target.value))}
                    leftIcon={<Phone className="h-4 w-4 text-electric-500" />}
                    placeholder="+998 (90) 123-45-67"
                  />
                </div>
                <Button variant="brand" isLoading={guestLoading} onClick={() => void sendOtp()}>
                  SMS kod olish
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Input
                    label="SMS tasdiqlash kodi"
                    type="text"
                    inputMode="numeric"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6 xonali kod"
                  />
                </div>
                <Button variant="brand" isLoading={guestLoading} onClick={() => void confirmOtpAndLookup()}>
                  Tasdiqlash
                </Button>
              </div>
            )}
            {otpStep === "code" ? (
              <button
                type="button"
                className="text-xs text-electric-500 hover:underline"
                onClick={() => {
                  setOtpStep("phone");
                  setOtpCode("");
                }}
              >
                Boshqa telefon raqamini kiritish
              </button>
            ) : null}
            <p className="mt-3 text-center text-xs text-text-400">
              Yoki{" "}
              <Link href="/auth" className="font-semibold text-electric-500 hover:underline">
                tizimga kiring
              </Link>
              {profile?.phone ? " — buyurtmalar avtomatik bog'lanadi." : " — profilga telefon qo'shing."}
            </p>
          </div>
        ) : null}

        {listLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="skeleton h-28 rounded-2xl" />
            ))}
          </div>
        ) : error && !orders.length ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-6 text-center">
            <p className="mb-4 text-text-300">{error}</p>
            {!isLoggedIn ? (
              <Link href="/auth">
                <Button>Kirish</Button>
              </Link>
            ) : (
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Yangilash
              </Button>
            )}
          </div>
        ) : scopedOrders.length ? (
          <div className="space-y-4">
            {scopedOrders.map((order, index) => (
              <OrderFlowCard
                key={order.id}
                order={order}
                index={index}
                guestPhone={guestVerificationToken ? guestPhoneE164 : undefined}
                guestVerificationToken={guestVerificationToken}
              />
            ))}
          </div>
        ) : orders.length ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center text-text-300">
            Bu bo&apos;limda buyurtmalar yo&apos;q.
          </div>
        ) : (
          <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center text-text-300">
            Hozircha buyurtmalar yo&apos;q.
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
