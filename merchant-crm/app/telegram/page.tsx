"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { Button } from "@/components/ui/button";
import { useTelegramWebAppAuth } from "@/hooks/useTelegramWebAppAuth";

function TelegramCrmGate() {
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shop_id");
  const nextPath = searchParams.get("next");
  const { loading, error, destination } = useTelegramWebAppAuth({ shopId, nextPath });

  if (loading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas bg-hero-glow px-6">
        <BozorliiiLogo variant="full" size="md" href={null} badge="CRM" />
        <p className="text-sm text-text-400">Telegram orqali ulanmoqda…</p>
      </main>
    );
  }

  const loginNext = `/telegram${shopId ? `?shop_id=${shopId}` : ""}${nextPath ? `&next=${encodeURIComponent(nextPath)}` : ""}`;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas bg-hero-glow px-6 text-center">
      <BozorliiiLogo variant="full" size="md" href={null} badge="CRM" />
      <h1 className="text-xl font-bold text-text-100">Kirish mumkin emas</h1>
      <p className="max-w-sm text-sm text-text-400">{error}</p>
      <p className="max-w-sm text-xs text-text-400">
        Bozorliii merchant bot + web CRM — bitta hisob. Botda rasm yuboring, CRM da buyurtma va chat.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/login?next=${encodeURIComponent(loginNext)}`}>
          <Button>CRM login (OTP)</Button>
        </Link>
        <Link href="/login">
          <Button variant="secondary">Brauzer login</Button>
        </Link>
      </div>
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
