"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

/** Native/PWA install banner — yoqish: NEXT_PUBLIC_CRM_APP_PROMPTS=1 */
const APP_PROMPTS_ENABLED = process.env.NEXT_PUBLIC_CRM_APP_PROMPTS === "1";

export function CrmPwaInstall() {
  const [offline, setOffline] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosTip, setShowIosTip] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ua = navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone);
    setShowIosTip(ios && !standalone);
    setOffline(!navigator.onLine);

    const onPrompt = (event: Event) => {
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

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <>
      {APP_PROMPTS_ENABLED && !installed && (deferredPrompt || showIosTip) ? (
        <div className="fixed bottom-20 left-0 right-0 z-[70] mx-auto w-full max-w-lg px-4">
          <div className="rounded-2xl border border-electric-200 bg-white p-3 shadow-lg">
            <p className="text-sm font-semibold text-text-100">CRM ilovani o&apos;rnating</p>
            {deferredPrompt ? (
              <button
                type="button"
                className="mt-2 w-full rounded-xl bg-electric-500 px-3 py-2 text-sm font-semibold text-white"
                onClick={() => {
                  void (async () => {
                    const event = deferredPrompt;
                    if (!event) return;
                    await event.prompt();
                    await event.userChoice.catch(() => undefined);
                    setDeferredPrompt(null);
                  })();
                }}
              >
                Android ilova sifatida o&apos;rnatish
              </button>
            ) : (
              <p className="mt-1 text-xs text-text-400">
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
            Internet yo&apos;q. Ulanish tiklangach CRM avtomatik yangilanadi.
          </p>
        </div>
      ) : null}
    </>
  );
}
