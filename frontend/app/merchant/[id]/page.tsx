"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { getMapStores } from "@/lib/api";

export default function MerchantRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getMapStores();
        const store = res.stores.find((row) => row.id === id);
        if (cancelled) return;
        if (store?.slug) {
          router.replace(`/shop/${store.slug}`);
          return;
        }
      } catch {
        /* fall through to map */
      }
      if (!cancelled) {
        router.replace(`/map?merchant_id=${encodeURIComponent(id)}&focus=true`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas">
      <p className="text-sm text-ink-500">Do&apos;konga yo&apos;naltirilmoqda…</p>
    </main>
  );
}
