"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { BrandPageLoader } from "@/components/brand/brand-page-loader";

export function CrmLegacyRedirect({ target }: { target: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(target);
  }, [router, target]);
  return <BrandPageLoader label="Yo'naltirilmoqda…" />;
}
