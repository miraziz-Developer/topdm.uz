"use client";

import Link from "next/link";
import { Phone } from "lucide-react";
import { useEffect, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getMyOrders, lookupOrdersByPhone } from "@/lib/api";
import { readGuestPhone, saveGuestPhone } from "@/lib/guest-phone";
import { buildMapFocusHref, parseBlockLetterFromSector } from "@/lib/map-stores";
import { ApiError } from "@/lib/http-client";
import { orderStatusLabel } from "@/lib/order-status";
import { parseShopLocation } from "@/lib/shop-location";
import {
  applyPhoneMaskInput,
  formatUzbekPhoneParenDisplay,
  normalizeUzbekPhoneE164,
  UZ_PHONE_E164_REGEX,
} from "@/utils/phone-mask";
import { formatPrice } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";
import type { Order } from "@/types";

function OrderCard({ order }: { order: Order }) {
  const pin = parseShopLocation({
    floor: order.shop.floor || order.shop.block_sector || "",
    ipadrom: order.shop.ipadrom || "",
    block_sector: order.shop.block_sector,
    section: order.shop.section,
  });
  const blockFromApi = parseBlockLetterFromSector(order.shop.block_sector);
  const mapHref = buildMapFocusHref({
    merchantId: order.shop.id,
    shopSlug: order.shop.slug,
    block: blockFromApi ?? pin.block,
    stall: pin.stall,
    focus: true,
    source: "order",
    orderId: order.id,
  });

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-text-400">#{order.id.slice(0, 8)}</p>
          <h2 className="mt-1 text-lg font-semibold text-text-100">{order.product.name}</h2>
          <p className="mt-1 text-sm text-text-300">{order.shop.name}</p>
        </div>
        <span className="rounded-full bg-gold-500/10 px-3 py-1 text-xs font-medium text-gold-400">
          {orderStatusLabel(order.status)}
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm text-text-300">
        <span>{order.quantity} dona</span>
        <span className="price-mono font-semibold text-text-100">{formatPrice(order.total_price)}</span>
      </div>
      <div className="mt-4">
        <Link
          href={mapHref}
          className="inline-flex w-full items-center justify-center rounded-xl border border-electric-500/30 bg-electric-500/10 py-2.5 text-xs font-bold text-electric-600 transition hover:bg-electric-500/15"
        >
          Do&apos;konga borish (xarita)
        </Link>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const { push } = useToast();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const authHydrated = useAuthStore((state) => state.hydrated);
  const userHydrated = useUserStore((state) => state.hydrated);
  const profile = useUserStore((state) => state.profile);

  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [guestPhone, setGuestPhone] = useState(() => {
    const saved = readGuestPhone();
    return saved ? formatUzbekPhoneParenDisplay(saved) : "+998 ";
  });
  const [guestLoading, setGuestLoading] = useState(false);

  useEffect(() => {
    if (!authHydrated || !userHydrated) return;

    if (isLoggedIn) {
      void (async () => {
        try {
          const mine = await getMyOrders();
          let items = mine.items ?? [];
          const saved = readGuestPhone();
          if (saved && UZ_PHONE_E164_REGEX.test(saved)) {
            try {
              const guest = await lookupOrdersByPhone(saved);
              const byId = new Map<string, Order>();
              for (const o of items) byId.set(o.id, o);
              for (const o of guest.items ?? []) byId.set(o.id, o);
              items = Array.from(byId.values());
            } catch {
              // ignore guest fallback errors for logged-in flow
            }
          }
          setOrders(items);
          if (!items.length) {
            setError("Buyurtma topilmadi. Profil telefoni va checkout telefoni bir xil ekanini tekshiring.");
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
    if (saved && UZ_PHONE_E164_REGEX.test(saved)) {
      setGuestLoading(true);
      void lookupOrdersByPhone(saved)
        .then((response) => {
          setOrders(response.items);
          setError(response.items.length ? null : "Bu telefon uchun buyurtma topilmadi.");
        })
        .catch((err) => {
          setOrders([]);
          setError(err instanceof ApiError ? err.message : "Buyurtmalarni yuklab bo'lmadi.");
        })
        .finally(() => {
          setGuestLoading(false);
          setLoading(false);
        });
      return;
    }

    setLoading(false);
    setError(null);
  }, [authHydrated, userHydrated, isLoggedIn]);

  const lookupGuest = async () => {
    const phoneE164 = normalizeUzbekPhoneE164(guestPhone);
    if (!UZ_PHONE_E164_REGEX.test(phoneE164)) {
      push("Telefon raqamini to'g'ri kiriting", "error");
      return;
    }
    setGuestLoading(true);
    setError(null);
    try {
      saveGuestPhone(phoneE164);
      const response = await lookupOrdersByPhone(phoneE164);
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

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-3xl px-4 pb-8 sm:px-5">
        <h1 className="mb-2 text-3xl font-bold text-text-100">Buyurtmalarim</h1>
        <p className="mb-6 text-sm text-text-400">
          {isLoggedIn
            ? "Profil telefon raqamingiz bo'yicha barcha bronlar."
            : "Telefon raqamingiz bilan bronlarni ko'ring yoki tizimga kiring."}
        </p>

        {showGuestForm ? (
          <div className="mb-6 rounded-2xl border border-border-subtle bg-surface p-4">
            <p className="mb-3 text-sm text-text-300">
              Mehmon sifatida bron qilgan bo&apos;lsangiz, checkoutda kiritgan telefonni qidiring.
            </p>
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
              <Button variant="brand" isLoading={guestLoading} onClick={() => void lookupGuest()}>
                Qidirish
              </Button>
            </div>
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
        ) : orders.length ? (
          <div className="space-y-4">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
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
