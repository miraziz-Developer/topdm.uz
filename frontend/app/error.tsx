"use client";

import { Button } from "@/components/ui/button";
import { reportClientError } from "@/lib/browser-monitoring";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportClientError(error, error.digest), [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="max-w-md rounded-3xl border border-border-subtle bg-white p-8 text-center shadow-card">
        <h1 className="text-2xl font-bold text-ink-900">Nimadir noto&apos;g&apos;ri ketdi</h1>
        <p className="mt-3 text-sm text-ink-500">Sahifani yuklashda xatolik yuz berdi. Qayta urinib ko&apos;ring.</p>
        <Button className="mt-6" onClick={reset}>
          Qayta urinish
        </Button>
      </div>
    </main>
  );
}
