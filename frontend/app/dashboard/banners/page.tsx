"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { BottomNav } from "@/components/BottomNav";
import { BannerCrmPanel } from "@/components/dashboard/banner-crm-panel";
import { Navigation } from "@/components/Navigation";
import { useAuthStore } from "@/stores/auth-store";
import { useUserStore } from "@/stores/user-store";

export default function MerchantBannersPage() {
  const router = useRouter();
  const hydrated = useAuthStore((s) => s.hydrated);
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const role = useUserStore((s) => s.profile?.role);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn) {
      router.replace("/auth?next=/dashboard/banners");
      return;
    }
    if (role && role !== "merchant") {
      router.replace("/profile");
    }
  }, [hydrated, isLoggedIn, role, router]);

  if (!hydrated || !isLoggedIn) {
    return (
      <main className="min-h-screen bg-canvas">
        <Navigation />
        <div className="mx-auto max-w-6xl px-4 pt-28">
          <div className="skeleton h-64 rounded-2xl" />
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-6">
      <Navigation />
      <div className="page-content-top mx-auto max-w-6xl px-4 pb-6 sm:px-5">
        <BannerCrmPanel />
      </div>
      <BottomNav />
    </main>
  );
}
