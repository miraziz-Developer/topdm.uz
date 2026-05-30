"use client";

import { BottomNav } from "@/components/BottomNav";
import { UnifiedAuthPanel } from "@/components/auth/unified-auth-panel";
import { Navigation } from "@/components/Navigation";

export default function AuthPage() {
  return (
    <main className="page-shell min-h-dvh bg-canvas md:pb-8">
      <Navigation />
      <div className="page-content-top flex min-h-[80vh] items-center justify-center px-4 sm:px-5">
        <UnifiedAuthPanel />
      </div>
      <BottomNav />
    </main>
  );
}
