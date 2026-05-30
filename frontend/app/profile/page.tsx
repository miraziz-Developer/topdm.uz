"use client";

import { motion } from "framer-motion";
import { Mail, ShoppingBag, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { BottomNav } from "@/components/BottomNav";
import { Navigation } from "@/components/Navigation";
import { PremiumCabinet } from "@/components/profile/cabinet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";
import { useLoyaltyStore } from "@/stores/loyalty-store";
import { useUserStore } from "@/stores/user-store";

export default function ProfilePage() {
  const profile = useUserStore((state) => state.profile);
  const loading = useUserStore((state) => state.loading);
  const hydrated = useUserStore((state) => state.hydrated);
  const refresh = useUserStore((state) => state.refresh);
  const logout = useUserStore((state) => state.logout);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const coins = useLoyaltyStore((state) => state.coins);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const needsLogin = hydrated && !isLoggedIn;
  const isLoading = !hydrated || (isLoggedIn && loading && !profile);

  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-10">
      <Navigation />
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="page-content-top relative mx-auto max-w-7xl px-4 pb-10 sm:px-5 md:px-6"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 mesh-bg opacity-90" />

        {isLoading ? (
          <div className="grid gap-4 lg:grid-cols-12">
            <div className="skeleton h-72 rounded-[1.75rem] lg:col-span-4" />
            <div className="space-y-4 lg:col-span-8">
              <div className="skeleton h-56 rounded-[1.75rem]" />
              <div className="skeleton h-64 rounded-[1.75rem]" />
            </div>
          </div>
        ) : needsLogin ? (
          <div className="flex min-h-[52vh] items-center justify-center">
            <Card className="w-full max-w-lg overflow-hidden border-border-subtle shadow-card">
              <CardContent className="space-y-6 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-electric">
                  <ShieldCheck className="h-8 w-8 text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold text-ink-900">Kirish talab qilinadi</h2>
                  <p className="text-sm leading-relaxed text-ink-500">
                    Profilni ko&apos;rish va buyurtmalarni kuzatish uchun email kod yoki Telegram orqali tizimga kiring. Bron qilgan telefon raqamingizni profilga qo&apos;shing.
                  </p>
                </div>
                <div className="grid gap-3 text-left sm:grid-cols-3">
                  {[
                    { icon: Mail, label: "Email kod bilan kirish" },
                    { icon: ShoppingBag, label: "Buyurtmalar tarixi" },
                    { icon: Wallet, label: "Coin va chegirmalar" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-border-subtle bg-elevated/70 p-3">
                      <item.icon className="mb-2 h-4 w-4 text-electric-500" />
                      <p className="text-xs text-ink-600">{item.label}</p>
                    </div>
                  ))}
                </div>
                <Link href="/auth" className="inline-flex w-full sm:w-auto">
                  <Button size="lg" className="w-full min-w-[220px]">
                    Kirish
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        ) : profile ? (
          <PremiumCabinet
            profile={profile}
            coins={coins}
            onLogout={() =>
              void logout().then(() => {
                window.location.href = "/auth";
              })
            }
          />
        ) : (
          <Card className="border-red/20 bg-red/5">
            <CardContent className="space-y-4 p-6 text-center">
              <p className="text-sm text-red">Profilni yuklab bo&apos;lmadi. Qayta urinib ko&apos;ring.</p>
              <Button variant="secondary" onClick={() => void refresh()}>
                Yangilash
              </Button>
            </CardContent>
          </Card>
        )}
      </motion.div>
      <BottomNav />
    </main>
  );
}
