"use client";

import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="uz">
      <body className="bg-canvas font-sans antialiased">
        <main className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md rounded-3xl border border-border-subtle bg-white p-8 text-center shadow-card">
            <h1 className="text-2xl font-bold text-ink-900">Platforma vaqtincha ishlamayapti</h1>
            <p className="mt-3 text-sm text-ink-500">{error.message || "Kutilmagan xatolik yuz berdi."}</p>
            <Button className="mt-6" onClick={reset}>
              Qayta yuklash
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
