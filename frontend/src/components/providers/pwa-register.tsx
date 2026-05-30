"use client";

import { useEffect, useState } from "react";

import { useT } from "@/i18n/locale-provider";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaRegister() {
  const t = useT();
  const [offline, setOffline] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosTip, setShowIosTip] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setShowIosTip(ios && !standalone);

    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setShowIosTip(false);
    };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      {!installed && (deferredPrompt || showIosTip) ? (
        <div className="fixed bottom-20 left-0 right-0 z-[70] mx-auto w-full max-w-lg px-4">
          <div className="rounded-2xl border border-electric-200 bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-ink-900">Topdim ilovasini o'rnating</p>
            {deferredPrompt ? (
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-electric-500 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void (async () => {
                    const promptEvent = deferredPrompt;
                    if (!promptEvent) return;
                    await promptEvent.prompt();
                    await promptEvent.userChoice.catch(() => undefined);
                    setDeferredPrompt(null);
                  })();
                }}
              >
                Android ilova sifatida o'rnatish
              </button>
            ) : (
              <p className="mt-1 text-xs text-ink-600">
                iPhone: Safari menyusi → <span className="font-semibold">Share</span> →{" "}
                <span className="font-semibold">Add to Home Screen</span>.
              </p>
            )}
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