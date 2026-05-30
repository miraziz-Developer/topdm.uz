"use client";

import { Toaster } from "sonner";
import { CrmPwaInstall } from "@/components/providers/crm-pwa-install";
import { MobileCrmRuntime } from "@/components/providers/mobile-crm-runtime";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MobileCrmRuntime />
      <CrmPwaInstall />
      {children}
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{
          classNames: {
            toast: "rounded-2xl border border-border-subtle shadow-lg",
          },
        }}
      />
    </>
  );
}
