"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { BrandEmptyState } from "@/components/brand/brand-empty-state";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("merchant_crm_page_error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas bg-hero-glow px-4 py-16">
      <div className="w-full max-w-lg" role="alert">
        <BrandEmptyState
          icon={AlertTriangle}
          title="Sahifani ochib bo‘lmadi"
          description="Vaqtinchalik xatolik yuz berdi. Kiritgan ma’lumotlaringizni tekshirib, qayta urinib ko‘ring."
        >
          <Button type="button" onClick={reset} leftIcon={<RotateCcw className="h-4 w-4" />}>
            Qayta urinish
          </Button>
        </BrandEmptyState>
      </div>
    </main>
  );
}