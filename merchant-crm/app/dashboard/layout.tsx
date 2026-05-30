"use client";

import { BrandPageLoader } from "@/components/brand/brand-page-loader";
import { MerchantShell } from "@/components/merchant-shell";
import { useMerchantAuth } from "@/hooks/useMerchantAuth";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { ready, loading, signOut } = useMerchantAuth();

  if (!ready) {
    return (
      <BrandPageLoader
        label={loading ? "CRM ochilmoqda…" : "Kirish sahifasiga yo'naltirilmoqda…"}
      />
    );
  }

  return <MerchantShell onSignOut={signOut}>{children}</MerchantShell>;
}
