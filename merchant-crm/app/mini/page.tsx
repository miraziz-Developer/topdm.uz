"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { TopdimLogo } from "@/components/brand/topdim-logo";
import { PrecisionLocationWorkspace } from "@/components/precision-location-workspace";
import { Button } from "@/components/ui/button";
import { getAccessToken } from "@/lib/auth";

export default function MerchantMiniAppPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    const tg = (window as Window & { Telegram?: { WebApp?: { ready: () => void; expand: () => void } } }).Telegram
      ?.WebApp;
    tg?.ready();
    tg?.expand();
    setAuthed(Boolean(getAccessToken()));
  }, []);

  if (authed === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-text-400">Yuklanmoqda…</p>
      </main>
    );
  }

  if (!authed) {
    const returnTo = encodeURIComponent("/mini");
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas bg-hero-glow px-6 text-center">
        <TopdimLogo variant="full" size="sm" href={null} badge="Mini" />
        <h1 className="text-xl font-bold text-text-100">Avval CRM ga kiring</h1>
        <p className="max-w-sm text-sm text-text-400">
          Rasta joylashuvini saqlash uchun merchant token kerak. Brauzerda CRM login qiling, keyin Mini App ni qayta
          oching.
        </p>
        <Link href={`/login?next=${returnTo}`}>
          <Button>Kirish</Button>
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-canvas">
      <header className="border-b border-border-subtle bg-surface px-4 py-3">
        <TopdimLogo variant="full" size="sm" href={null} badge="Mini" />
        <h1 className="mt-2 text-lg font-bold text-text-100">Rasta joylashuvi</h1>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <PrecisionLocationWorkspace />
      </div>
    </main>
  );
}
