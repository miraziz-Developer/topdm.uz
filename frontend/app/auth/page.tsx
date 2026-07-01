"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { BottomNav } from "@/components/BottomNav";
import { UnifiedAuthPanel } from "@/components/auth/unified-auth-panel";
import { Navigation } from "@/components/Navigation";
import { pageShell, pageContentTop, pageWithBottomNav } from "@/lib/responsive-layout";

function AuthBody() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next");
  const redirectTo = next && next.startsWith("/") ? next : "/profile";

  return <UnifiedAuthPanel redirectTo={redirectTo} />;
}

export default function AuthPage() {
  return (
    <main className={`${pageShell} ${pageWithBottomNav}`}>
      <Navigation />
      <div className={`${pageContentTop} flex min-h-[80vh] items-center justify-center px-4 sm:px-5`}>
        <Suspense fallback={<div className="h-40 w-full max-w-md animate-pulse rounded-2xl bg-elevated" />}>
          <AuthBody />
        </Suspense>
      </div>
      <BottomNav />
    </main>
  );
}
