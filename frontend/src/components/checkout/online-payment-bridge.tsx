"use client";

import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { fetchPaymentRedirect } from "@/lib/api";

type OnlinePaymentBridgeProps = {
  provider: "click" | "payme";
  amount: number;
  checkoutId?: string;
  orderId?: string;
  labelId: string;
};

const LABELS = {
  click: { title: "Click orqali to'lov", brand: "Click" },
  payme: { title: "Payme orqali to'lov", brand: "Payme" },
} as const;

export function OnlinePaymentBridge({ provider, checkoutId, orderId, amount, labelId }: OnlinePaymentBridgeProps) {
  const [loading, setLoading] = useState(true);
  const [gatewayUrl, setGatewayUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetchPaymentRedirect({
          provider,
          amount,
          checkout_id: checkoutId,
          order_id: orderId,
        });
        if (cancelled) return;
        setGatewayUrl(res.url);
        setMessage(res.message ?? null);
        if (res.url) {
          window.location.href = res.url;
        }
      } catch {
        if (!cancelled) {
          setMessage("To'lov havolasini yuklab bo'lmadi. Do'konda naqd yoki terminal orqali to'lang.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, checkoutId, orderId, amount]);

  const meta = LABELS[provider];

  return (
    <Card className="mx-auto max-w-lg border-electric-500/15">
      <CardContent className="space-y-5 p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-electric-500/10 text-electric-500">
          {loading ? <Loader2 className="h-7 w-7 animate-spin" /> : <CreditCard className="h-7 w-7" />}
        </div>
        <div>
          <h1 className="text-xl font-bold text-ink-900">{meta.title}</h1>
          <p className="mt-2 text-sm text-ink-500">
            Buyurtma #{labelId.slice(0, 8)} ·{" "}
            <span className="price-mono font-semibold text-ink-800">
              {amount.toLocaleString("uz-UZ")} so&apos;m
            </span>
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-ink-500">{meta.brand} sahifasiga yo&apos;naltirilmoqda…</p>
        ) : null}

        {message ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{message}</p> : null}

        {gatewayUrl && !loading ? (
          <Button
            variant="brand"
            className="w-full"
            leftIcon={<ExternalLink className="h-4 w-4" />}
            onClick={() => {
              window.location.href = gatewayUrl;
            }}
          >
            {meta.brand} da to&apos;lash
          </Button>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/orders" className="text-sm font-semibold text-electric-500 hover:underline">
            Buyurtmalarim
          </Link>
          <Link href="/map" className="text-sm font-semibold text-ink-500 hover:underline">
            Xaritaga qaytish
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
