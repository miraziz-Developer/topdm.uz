"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("platform_admin_page_error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <section className="admin-card w-full max-w-lg text-center" role="alert">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15 text-red-300">
          <AlertTriangle className="h-7 w-7" />
        </div>
        <h1 className="mt-5 text-2xl font-bold">Sahifani ochib bo‘lmadi</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Vaqtinchalik xatolik yuz berdi. Amalni qayta bajaring; muammo davom etsa tizim administratoriga xabar bering.
        </p>
        <Button className="mt-6" type="button" onClick={reset}>
          <RotateCcw className="h-4 w-4" />
          Qayta urinish
        </Button>
      </section>
    </main>
  );
}