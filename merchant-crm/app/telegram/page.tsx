"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { TopdimLogo } from "@/components/brand/topdim-logo";
import { Button } from "@/components/ui/button";
import { postJson } from "@/lib/api";
import { setAccessToken } from "@/lib/auth";
import { getTelegramWebApp, getWebAppInitData } from "@/lib/telegram-webapp";

function TelegramCrmGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shop_id");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const tg = getTelegramWebApp();
    tg?.ready();
    tg?.expand();

    const initData = getWebAppInitData();
    if (!initData) {
      setLoading(false);
      setError("Faqat Telegram bot ichidagi CRM tugmasidan oching.");
      return;
    }

    void (async () => {
      try {
        const res = await postJson<{ token: string; role: string }>("/auth/telegram/webapp", {
          init_data: initData,
          shop_id: shopId,
        });
        if (res.role !== "merchant" || !res.token) {
          setError("Merchant hisob topilmadi. Botda /start shop_<UUID> va kontakt ulang.");
          setLoading(false);
          return;
        }
        setAccessToken(res.token);
        router.replace("/dashboard");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Kirish xatosi";
        setError(msg);
        setLoading(false);
      }
    })();
  }, [router, shopId]);

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas bg-hero-glow px-6">
        <TopdimLogo variant="full" size="md" href={null} badge="CRM" />
        <p className="text-sm text-text-400">Telegram orqali ulanmoqda…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas bg-hero-glow px-6 text-center">
      <TopdimLogo variant="full" size="md" href={null} badge="CRM" />
      <h1 className="text-xl font-bold text-text-100">Kirish mumkin emas</h1>
      <p className="max-w-sm text-sm text-text-400">{error}</p>
      <Link href={`/login${shopId ? `?next=${encodeURIComponent(`/telegram?shop_id=${shopId}`)}` : ""}`}>
        <Button>CRM login (OTP)</Button>
      </Link>
    </main>
  );
}

export default function TelegramCrmPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas">
          <p className="text-sm text-text-400">Yuklanmoqda…</p>
        </main>
      }
    >
      <TelegramCrmGate />
    </Suspense>
  );
}
