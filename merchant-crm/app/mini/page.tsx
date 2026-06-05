"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { PrecisionLocationWorkspace } from "@/components/precision-location-workspace";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/auth";
import { getWebAppInitData, waitForWebAppInitData } from "@/lib/telegram-webapp";

function MiniTelegramRedirect({ shopId }: { shopId: string | null }) {
  const router = useRouter();
  useEffect(() => {
    const q = new URLSearchParams();
    if (shopId) q.set("shop_id", shopId);
    q.set("next", "/mini");
    router.replace(`/telegram?${q.toString()}`);
  }, [router, shopId]);
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-sm text-text-400">Telegram orqali ulanmoqda…</p>
    </main>
  );
}

function MiniLoginFallback({ shopId }: { shopId: string | null }) {
  const loginNext = encodeURIComponent(
    `/telegram?next=${encodeURIComponent("/mini")}${shopId ? `&shop_id=${shopId}` : ""}`,
  );
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      <BozorliiiLogo variant="full" size="sm" href={null} badge="Xarita" />
      <h1 className="text-lg font-bold text-text-100">Kirish kerak</h1>
      <p className="max-w-sm text-sm text-text-400">
        Merchant botda <strong>CRM Panel</strong> yoki <strong>Xarita</strong> tugmasini bosing — parol alohida ilova
        emas, bir xil tizim.
      </p>
      <Link href={`/login?next=${loginNext}`}>
        <Button>CRM ga kirish</Button>
      </Link>
    </main>
  );
}

function MiniMapView() {
  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-border-subtle bg-surface px-4 py-3">
        <BozorliiiLogo variant="full" size="sm" href={null} badge="Xarita" />
        <h1 className="mt-2 text-lg font-bold text-text-100">Rasta joylashuvi</h1>
        <p className="text-xs text-text-400">Bot va CRM bir xil xarita — saqlang, mijozlar topadi</p>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PrecisionLocationWorkspace />
      </div>
    </main>
  );
}

function MiniAppContent() {
  const searchParams = useSearchParams();
  const shopId = searchParams.get("shop_id");
  const hasToken = Boolean(getAccessToken());
  const [tgChecked, setTgChecked] = useState(false);
  const [hasTgData, setHasTgData] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void waitForWebAppInitData().then((data) => {
      if (cancelled) return;
      setHasTgData(Boolean(data) || Boolean(getWebAppInitData()));
      setTgChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasToken && !tgChecked) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-text-400">Telegram ulanmoqda…</p>
      </main>
    );
  }
  if (!hasToken && hasTgData) {
    return <MiniTelegramRedirect shopId={shopId} />;
  }
  if (!hasToken) {
    return <MiniLoginFallback shopId={shopId} />;
  }
  return <MiniMapView />;
}

export default function MerchantMiniAppPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas">
          <p className="text-sm text-text-400">Yuklanmoqda…</p>
        </main>
      }
    >
      <MiniAppContent />
    </Suspense>
  );
}
