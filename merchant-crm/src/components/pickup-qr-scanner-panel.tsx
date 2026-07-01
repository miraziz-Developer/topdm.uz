"use client";

import { ScanLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  PickupScanSuccessOverlay,
  type PickupScanResult,
} from "@/components/pickup-scan-success-overlay";
import { scanMerchantPickupQr } from "@/lib/api";
import { getTelegramWebApp } from "@/lib/telegram-webapp";
import { cn } from "@/lib/utils";

export function PickupQrScannerPanel({ autoStart = false }: { autoStart?: boolean }) {
  const readerId = useId().replace(/:/g, "");
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<PickupScanResult | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const busyRef = useRef(false);

  const hapticSuccess = useCallback(() => {
    try {
      getTelegramWebApp()?.HapticFeedback?.notificationOccurred("success");
    } catch {
      /* ignore */
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => undefined);
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const processToken = useCallback(
    async (token: string) => {
      const trimmed = token.trim();
      if (!trimmed || busyRef.current) return;
      busyRef.current = true;
      setBusy(true);
      try {
        const res = await scanMerchantPickupQr(trimmed);
        setLastResult(res);
        setShowOverlay(true);
        hapticSuccess();
        if (res.already_completed) {
          toast.info(res.headline);
        } else {
          toast.success(res.headline);
        }
        await stopScanner();
      } catch {
        toast.error("QR skaner xato — kod noto'g'ri yoki boshqa do'kon buyurtmasi");
        try {
          getTelegramWebApp()?.HapticFeedback?.notificationOccurred("error");
        } catch {
          /* ignore */
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [hapticSuccess, stopScanner],
  );

  const startScanner = useCallback(async () => {
    if (scanning) return;
    setShowOverlay(false);
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      setScanning(true);
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: { width: 260, height: 260 } },
        (decoded) => {
          void processToken(decoded);
        },
        () => undefined,
      );
    } catch {
      toast.error("Kamera ochilmadi — ruxsat bering yoki tokenni qo'lda kiriting");
      setScanning(false);
      scannerRef.current = null;
    }
  }, [processToken, readerId, scanning]);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  useEffect(() => {
    if (!autoStart || scanning || busy) return;
    void startScanner();
  }, [autoStart, busy, scanning, startScanner]);

  return (
    <div className="space-y-4">
      <section className="crm-surface-card overflow-hidden">
        <div className="border-b border-border-subtle bg-gradient-to-br from-electric-500/10 to-transparent p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-electric-500" />
            <h2 className="text-base font-bold text-text-100">Olib ketish skaneri</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text-400">
            Mijoz QR ni skaner qiling — kim qaysi mahsulotni olib ketgani ekranda chiqadi, buyurtma avtomatik
            yopiladi.
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div
            id={readerId}
            className={cn(
              "mx-auto overflow-hidden rounded-2xl bg-black/90",
              scanning ? "min-h-[280px] max-w-sm" : "hidden",
            )}
          />

          {!scanning ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border-subtle bg-canvas/50 px-6 py-12 text-center">
              <ScanLine className="h-12 w-12 text-text-400/50" />
              <p className="mt-4 text-sm font-semibold text-text-100">Kamerani yoqing</p>
              <p className="mt-1 max-w-xs text-xs text-text-400">Mijoz QR kodini ramka ichiga joylashtiring</p>
              <Button type="button" className="mt-5" onClick={() => void startScanner()}>
                Skanerni boshlash
              </Button>
            </div>
          ) : (
            <div className="mt-4 flex justify-center">
              <Button type="button" variant="secondary" onClick={() => void stopScanner()}>
                To&apos;xtatish
              </Button>
            </div>
          )}

          <div className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-wide text-text-400">Qo&apos;lda token</label>
            <div className="mt-2 flex gap-2">
              <input
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="BLZ1...."
                className="h-11 min-w-0 flex-1 rounded-xl border-0 bg-canvas px-3 text-sm ring-1 ring-border-subtle"
              />
              <Button type="button" disabled={busy} onClick={() => void processToken(manualToken)}>
                Tekshirish
              </Button>
            </div>
          </div>
        </div>
      </section>

      {lastResult && !showOverlay ? (
        <section className="crm-surface-card p-4 text-center sm:p-5">
          <p className="text-sm font-semibold text-text-100">{lastResult.headline}</p>
          <Button type="button" className="mt-3" variant="secondary" onClick={() => setShowOverlay(true)}>
            Tafsilotlarni ko&apos;rish
          </Button>
        </section>
      ) : null}

      {showOverlay && lastResult ? (
        <PickupScanSuccessOverlay
          result={lastResult}
          onDismiss={() => setShowOverlay(false)}
          onScanAgain={() => {
            setShowOverlay(false);
            void startScanner();
          }}
        />
      ) : null}
    </div>
  );
}
