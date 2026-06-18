"use client";

import { CheckCircle2, ScanLine } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { scanMerchantPickupQr } from "@/lib/api";
import { cn, formatPrice } from "@/lib/utils";

type ScanResult = {
  order_id: string;
  status: string;
  already_completed: boolean;
  quantity: number;
  total_price: number;
  customer_phone: string;
  payment_method?: string | null;
  pickup_date?: string | null;
  pickup_time?: string | null;
  product: { id: string; name: string; price: number };
  shop: { id: string; name: string };
};

export function PickupQrScannerPanel() {
  const readerId = useId().replace(/:/g, "");
  const [scanning, setScanning] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<ScanResult | null>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);

  const processToken = useCallback(async (token: string) => {
    const trimmed = token.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const res = await scanMerchantPickupQr(trimmed);
      setLastResult(res);
      if (res.already_completed) {
        toast.info("Buyurtma allaqachon yakunlangan");
      } else {
        toast.success("Mahsulot berildi — buyurtma yopildi");
      }
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => undefined);
        scannerRef.current = null;
        setScanning(false);
      }
    } catch {
      toast.error("QR skaner xato — kod noto'g'ri yoki boshqa do'kon buyurtmasi");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const startScanner = useCallback(async () => {
    if (scanning) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(readerId);
      scannerRef.current = scanner;
      setScanning(true);
      setLastResult(null);
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

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      await scannerRef.current.stop().catch(() => undefined);
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  return (
    <div className="space-y-4">
      <section className="crm-surface-card overflow-hidden">
        <div className="border-b border-border-subtle bg-gradient-to-br from-electric-500/10 to-transparent p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-electric-500" />
            <h2 className="text-base font-bold text-text-100">Olib ketish skaneri</h2>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-text-400">
            Mijoz telefonidagi QR ni skaner qiling — mahsulot, buyurtma va mijoz ma&apos;lumotlari chiqadi, buyurtma
            avtomatik yakunlanadi.
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

      {lastResult ? (
        <section
          className={cn(
            "crm-surface-card p-4 sm:p-5",
            lastResult.already_completed ? "ring-1 ring-amber-500/30" : "ring-2 ring-emerald-500/35",
          )}
        >
          <div className="flex items-start gap-3">
            <CheckCircle2
              className={cn(
                "h-6 w-6 shrink-0",
                lastResult.already_completed ? "text-amber-500" : "text-emerald-500",
              )}
            />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-text-100">
                {lastResult.already_completed ? "Allaqachon yakunlangan" : "Muvaffaqiyatli berildi"}
              </p>
              <p className="mt-1 text-lg font-bold text-text-100">{lastResult.product.name}</p>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-text-400">Buyurtma ID</dt>
                  <dd className="font-mono font-semibold text-text-100">{lastResult.order_id.slice(0, 8).toUpperCase()}</dd>
                </div>
                <div>
                  <dt className="text-text-400">Miqdor</dt>
                  <dd className="font-semibold text-text-100">{lastResult.quantity} dona</dd>
                </div>
                <div>
                  <dt className="text-text-400">Summa</dt>
                  <dd className="font-semibold tabular-nums text-text-100">{formatPrice(lastResult.total_price)}</dd>
                </div>
                <div>
                  <dt className="text-text-400">Mijoz</dt>
                  <dd>
                    <a href={`tel:${lastResult.customer_phone}`} className="font-semibold text-electric-600">
                      {lastResult.customer_phone}
                    </a>
                  </dd>
                </div>
                {lastResult.pickup_date ? (
                  <div>
                    <dt className="text-text-400">Olib ketish</dt>
                    <dd className="text-text-100">
                      {lastResult.pickup_date}
                      {lastResult.pickup_time ? ` · ${lastResult.pickup_time}` : ""}
                    </dd>
                  </div>
                ) : null}
                {lastResult.payment_method ? (
                  <div>
                    <dt className="text-text-400">To&apos;lov</dt>
                    <dd className="text-text-100">{lastResult.payment_method}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
