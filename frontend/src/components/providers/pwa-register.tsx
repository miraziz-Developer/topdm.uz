"use client";

import { Download, Share, Smartphone, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import { dismissPwaInstallPrompt, isPwaInstallDismissed } from "@/lib/pwa-install-storage";
import { useT } from "@/i18n/locale-provider";
import { cn } from "@/lib/utils";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  return /android|iphone|ipad|ipod|mobile/i.test(window.navigator.userAgent);
}

export function PwaRegister() {
  const t = useT();
  const [offline, setOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showSheet, setShowSheet] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const standalone = isStandaloneMode();
    setInstalled(standalone);

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    setIsIos(ios);

    const canPrompt = !standalone && isMobileDevice() && !isPwaInstallDismissed();

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      if (canPrompt) {
        window.setTimeout(() => setShowSheet(true), 2200);
      }
    };

    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowSheet(false);
    };

    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);

    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    if (canPrompt && ios && !standalone) {
      window.setTimeout(() => setShowSheet(true), 3200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const handleDismiss = () => {
    dismissPwaInstallPrompt();
    setShowSheet(false);
  };

  const handleInstall = () => {
    void (async () => {
      const promptEvent = deferredPrompt;
      if (!promptEvent) return;
      await promptEvent.prompt();
      await promptEvent.userChoice.catch(() => undefined);
      setDeferredPrompt(null);
      setShowSheet(false);
    })();
  };

  const showInstallUi = !installed && showSheet && (deferredPrompt || isIos);

  return (
    <>
      {!installed && !showSheet && isMobileDevice() && !isPwaInstallDismissed() ? (
        <button
          type="button"
          aria-label="Ilovani o'rnatish"
          onClick={() => setShowSheet(true)}
          className={cn(
            "fixed bottom-[5.5rem] right-4 z-[65] flex h-12 w-12 items-center justify-center",
            "rounded-full bg-electric-500 text-white shadow-lg shadow-electric-500/35",
            "transition hover:scale-105 active:scale-95",
          )}
        >
          <Download className="h-5 w-5" aria-hidden />
        </button>
      ) : null}

      {showInstallUi ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-900/40 p-4 backdrop-blur-[2px] sm:items-center">
          <div
            role="dialog"
            aria-labelledby="pwa-install-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl"
          >
            <div className="relative bg-gradient-to-br from-electric-500/10 via-white to-accent-500/10 px-5 pb-4 pt-5">
              <button
                type="button"
                aria-label="Yopish"
                onClick={handleDismiss}
                className="absolute right-3 top-3 rounded-full p-2 text-ink-500 hover:bg-black/5"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl shadow-md ring-2 ring-white">
                  <Image src="/pwa-icon/192" alt="" width={56} height={56} unoptimized className="h-full w-full object-cover" />
                </div>
                <div>
                  <p id="pwa-install-title" className="text-base font-bold text-ink-900">
                    Bozorliii ilovasi
                  </p>
                  <p className="text-xs text-ink-600">Uy ekraniga qo&apos;shing — tezroq ochiladi</p>
                </div>
              </div>
            </div>

            <ul className="space-y-2 px-5 py-4 text-sm text-ink-700">
              <li className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
                AI qidiruv va rasm bo&apos;yicha topish
              </li>
              <li className="flex items-start gap-2">
                <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
                Brauzer panelisiz — to&apos;liq ekran ilova rejimi
              </li>
              <li className="flex items-start gap-2">
                <Download className="mt-0.5 h-4 w-4 shrink-0 text-electric-500" aria-hidden />
                App Store kerak emas — bir bosish bilan
              </li>
            </ul>

            <div className="border-t border-border-subtle px-5 py-4">
              {deferredPrompt ? (
                <button
                  type="button"
                  onClick={handleInstall}
                  className="w-full rounded-2xl bg-electric-500 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-electric-500/25 transition hover:bg-electric-600"
                >
                  Android — ilova sifatida o&apos;rnatish
                </button>
              ) : isIos ? (
                <div className="rounded-2xl border border-electric-100 bg-electric-50/80 px-4 py-3 text-sm text-ink-800">
                  <p className="font-semibold text-ink-900">iPhone / iPad</p>
                  <p className="mt-2 flex items-center gap-2 text-xs leading-relaxed text-ink-700">
                    <Share className="h-4 w-4 shrink-0 text-electric-600" aria-hidden />
                    Safari pastidagi <strong>Share</strong> → <strong>Add to Home Screen</strong> →{" "}
                    <strong>Add</strong>
                  </p>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleDismiss}
                className="mt-3 w-full py-2 text-center text-xs font-medium text-ink-500 hover:text-ink-700"
              >
                Keyinroq eslatma
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {offline ? (
        <div className="fixed left-0 right-0 top-16 z-[60] mx-auto max-w-lg px-4">
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900 shadow-sm">
            {t("offline.banner")}
          </p>
        </div>
      ) : null}
    </>
  );
}
