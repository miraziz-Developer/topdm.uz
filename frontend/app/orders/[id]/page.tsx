"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { OrderFlowCard } from "@/components/profile/live-orders";
import { Button } from "@/components/ui/button";
import { getMyOrder } from "@/lib/api";
import { readGuestLookupToken, readGuestPhone } from "@/lib/guest-phone";
import { ApiError } from "@/lib/http-client";
import { pageContentTop, pageShell, pageWithBottomNav } from "@/lib/responsive-layout";
import { useAuthStore } from "@/stores/auth-store";
import type { Order } from "@/types";

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const orderId = params.id;
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const authHydrated = useAuthStore((s) => s.hydrated);

  const guestPhone = searchParams.get("phone") || readGuestPhone() || undefined;
  const guestToken =
    searchParams.get("token") ||
    (guestPhone ? readGuestLookupToken(guestPhone) ?? undefined : undefined);

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    try {
      const guest =
        guestPhone && guestToken
          ? { user_phone: guestPhone, verification_token: guestToken }
          : undefined;
      if (!isLoggedIn && !guest) {
        setError("Buyurtmani ko'rish uchun tizimga kiring yoki telefonni tasdiqlang.");
        setOrder(null);
        return;
      }
      const data = await getMyOrder(orderId, guest);
      setOrder(data);
    } catch (err) {
      setOrder(null);
      setError(err instanceof ApiError ? err.message : "Buyurtma topilmadi");
    } finally {
      setLoading(false);
    }
  }, [guestPhone, guestToken, isLoggedIn, orderId]);

  useEffect(() => {
    if (!authHydrated) return;
    void reload();
  }, [authHydrated, reload]);

  const backHref =
    guestPhone && guestToken
      ? `/orders?phone=${encodeURIComponent(guestPhone)}&token=${encodeURIComponent(guestToken)}`
      : "/orders";

  return (
    <main className={`${pageShell} ${pageWithBottomNav}`}>
      <Navigation />
      <div className={`${pageContentTop} mx-auto max-w-3xl px-4 pb-8 sm:px-5`}>
        <div className="mb-5 flex items-center gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border-subtle bg-surface text-ink-600 transition hover:bg-canvas"
            aria-label="Orqaga"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-electric-600">Buyurtma</p>
            <h1 className="text-lg font-bold text-ink-900">
              {order ? `#${order.id.slice(0, 8).toUpperCase()}` : "Tafsilotlar"}
            </h1>
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-80 rounded-2xl" />
        ) : error ? (
          <div className="rounded-2xl border border-border-subtle bg-surface p-8 text-center">
            <p className="text-sm text-ink-600">{error}</p>
            <Link href="/auth" className="mt-4 inline-block">
              <Button size="sm">Kirish</Button>
            </Link>
          </div>
        ) : order ? (
          <OrderFlowCard
            order={order}
            index={0}
            guestPhone={guestPhone}
            guestVerificationToken={guestToken}
            onUpdated={() => void reload()}
            linkToDetail={false}
            heroImage
          />
        ) : null}
      </div>
      <BottomNav />
    </main>
  );
}
