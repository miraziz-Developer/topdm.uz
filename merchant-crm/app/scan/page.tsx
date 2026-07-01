"use client";

import { Suspense, useEffect, useState } from "react";

import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { PickupQrScannerPanel } from "@/components/pickup-qr-scanner-panel";
import { resolveMerchantSession } from "@/lib/merchant-session";
import { getTelegramWebApp } from "@/lib/telegram-webapp";

function ScanView() {
  return (
    <main className="min-h-screen bg-canvas pb-8">
      <header className="border-b border-border-subtle bg-surface px-4 py-3">
        <BozorliiiLogo variant="full" size="sm" href={null} badge="Skaner" />
        <h1 className="mt-2 text-lg font-bold text-text-100">Mijoz QR skaneri</h1>
        <p className="text-xs text-text-400">Skaner qiling — mijoz va mahsulot aniq ko&apos;rinadi, buyurtma yopiladi</p>
      </header>
      <div className="mx-auto max-w-lg px-4 py-4">
        <PickupQrScannerPanel autoStart />
      </div>
    </main>
  );
}

function ScanAppContent() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tg = getTelegramWebApp();
      tg?.ready();
      tg?.expand();

      const token = await resolveMerchantSession();
      if (cancelled) return;

      if (token) {
        setState("ready");
        return;
      }

      setState("error");
      setError(
        "Telegram orqali kirish amalga oshmadi. Botda «QR Skaner» tugmasini yoping va qayta oching — alohida login shart emas.",
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-text-400">Telegram orqali ulanmoqda…</p>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
        <BozorliiiLogo variant="full" size="sm" href={null} badge="Skaner" />
        <h1 className="text-lg font-bold text-text-100">Kirish yangilanmadi</h1>
        <p className="max-w-sm text-sm text-text-400">{error}</p>
      </main>
    );
  }

  return <ScanView />;
}

export default function MerchantScanPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-canvas">
          <p className="text-sm text-text-400">Yuklanmoqda…</p>
        </main>
      }
    >
      <ScanAppContent />
    </Suspense>
  );
}
