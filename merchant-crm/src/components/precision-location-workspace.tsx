"use client";

import { Building2, MapPin, Navigation2, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmSection } from "@/components/crm/crm-section";
import { MerchantShopYandexMap } from "@/components/merchant-shop-yandex-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAutosave } from "@/hooks/useAutosave";
import {
  checkMarketGeofence,
  getMerchantMe,
  getWorkspaceDraft,
  patchWorkspaceDraft,
  saveMerchantPrecisionLocation,
} from "@/lib/api";
import { captureCurrentPosition } from "@/lib/geolocation";
import { marketDisplayName } from "@/lib/map/market-geo";

type PrecisionLocationWorkspaceProps = {
  marketSlug?: string;
};

const FLOORS = [
  { value: "1-qavat", label: "1-qavat" },
  { value: "2-qavat", label: "2-qavat" },
];

const BLOCKS = ["A", "B", "C", "D"];

export function PrecisionLocationWorkspace({ marketSlug = "ippodrom" }: PrecisionLocationWorkspaceProps) {
  const marketName = marketDisplayName(marketSlug);
  const [shopName, setShopName] = useState("Do'kon");
  const [floor, setFloor] = useState("1-qavat");
  const [block, setBlock] = useState("A");
  const [stall, setStall] = useState("");
  const [comment, setComment] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [insideMarket, setInsideMarket] = useState<boolean | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void getMerchantMe()
      .then((me) => setShopName(me.shop?.name || "Do'kon"))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const run = async () => {
      try {
        const { draft } = await getWorkspaceDraft();
        if (draft.floor) setFloor(String(draft.floor));
        if (draft.block) setBlock(String(draft.block));
        if (draft.stall) setStall(String(draft.stall));
        if (draft.comment) setComment(String(draft.comment));
      } catch {
        /* draft optional */
      } finally {
        setHydrated(true);
      }
    };
    void run();
  }, []);

  const draftPayload = useMemo(
    () => ({
      floor,
      block,
      stall,
      comment,
      indoor_pin_x: pin?.x ?? null,
      indoor_pin_y: pin?.y ?? null,
    }),
    [block, comment, floor, pin, stall],
  );

  const saveDraft = useCallback(async () => {
    await patchWorkspaceDraft(draftPayload);
  }, [draftPayload]);

  useAutosave({
    value: draftPayload,
    onSave: saveDraft,
    enabled: hydrated,
    successMessage: "Qoralama saqlandi",
  });

  const metadataReady = useMemo(
    () => Boolean(floor.trim() && block.trim() && stall.trim() && comment.trim().length >= 3),
    [block, comment, floor, stall],
  );

  const locationSummary = useMemo(() => {
    const qator = block && stall ? `${block}-blok · rasta ${stall}` : block ? `${block}-blok` : "—";
    return { qavat: floor || "—", qator, izoh: comment || "—" };
  }, [block, comment, floor, stall]);

  const applyGps = async (latitude: number, longitude: number, accuracy: number | null) => {
    setGps({ latitude, longitude, accuracy });
    const geofence = await checkMarketGeofence(marketSlug, latitude, longitude);
    setInsideMarket(geofence.inside);
    setPin(geofence.pin);
    return geofence;
  };

  const detectCurrentLocation = async () => {
    setLoadingGps(true);
    try {
      const reading = await captureCurrentPosition();
      const geofence = await applyGps(reading.latitude, reading.longitude, reading.accuracy);
      if (!geofence.inside) {
        toast.error("Siz bozor chegarasidan tashqaridasiz. Do'kon oldida turib qayta bosing.");
        return;
      }
      toast.success(
        reading.accuracy
          ? `Joylashuv aniqlandi (±${Math.round(reading.accuracy)} m)`
          : "Joylashuv aniqlandi",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "GPS ishlamadi");
    } finally {
      setLoadingGps(false);
    }
  };

  const handleMapMove = async (lat: number, lng: number) => {
    try {
      const geofence = await applyGps(lat, lng, gps?.accuracy ?? null);
      if (!geofence.inside) {
        toast.error("Pin bozor ichida bo'lishi kerak");
      }
    } catch {
      toast.error("Joylashuvni tekshirib bo'lmadi");
    }
  };

  const finalizeLocation = async () => {
    if (!metadataReady) {
      toast.error("Qavat, qator (blok/rasta) va izohni to'ldiring");
      return;
    }
    if (!gps || !pin) {
      toast.error("Avval xaritada do'kon joyini belgilang");
      return;
    }
    if (insideMarket === false) {
      toast.error("Joylashuv bozor ichida emas");
      return;
    }
    try {
      await saveMerchantPrecisionLocation({
        market_slug: marketSlug,
        latitude: gps.latitude,
        longitude: gps.longitude,
        accuracy: gps.accuracy,
        floor,
        block,
        stall,
        comment,
        indoor_pin_x: pin.x,
        indoor_pin_y: pin.y,
      });
      toast.success("Joylashuv saqlandi — mijozlar xaritada ko'radi");
      if (typeof window !== "undefined" && window.Telegram?.WebApp) {
        window.Telegram.WebApp.sendData(JSON.stringify({ action: "precision_saved" }));
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Saqlab bo'lmadi");
    }
  };

  return (
    <div className="space-y-4">
      <div className="crm-surface-card overflow-hidden">
        <div className="grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
          <div className="border-b border-border-subtle p-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">Bozor</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-text-100">
              <Building2 className="h-4 w-4 text-electric-500" />
              {marketName}
            </p>
          </div>
          <div className="border-b border-border-subtle p-4 lg:border-b-0 lg:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">Do&apos;kon</p>
            <p className="mt-1 flex items-center gap-2 font-semibold text-text-100">
              <Store className="h-4 w-4 text-electric-500" />
              {shopName}
            </p>
          </div>
          <div className="border-b border-border-subtle p-4 sm:border-b-0 sm:border-r">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">Qavat · Qator</p>
            <p className="mt-1 font-semibold text-text-100">
              {locationSummary.qavat}
              <span className="mx-1 text-text-400">·</span>
              {locationSummary.qator}
            </p>
          </div>
          <div className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-text-400">Izoh</p>
            <p className="mt-1 line-clamp-2 text-sm font-medium text-text-100">{locationSummary.izoh}</p>
          </div>
        </div>
      </div>

      <CrmSection
        title="Manzil ma'lumotlari"
        description="Mijozlar xaritada qayerdaligingizni shu maydonlar orqali tushunadi"
        icon={MapPin}
        action={
          <Button
            onClick={() => void detectCurrentLocation()}
            isLoading={loadingGps}
            variant="secondary"
            size="sm"
            leftIcon={<Navigation2 className="h-4 w-4" />}
          >
            Hozirgi joyim
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-300">Qavat</label>
            <select
              value={floor}
              onChange={(e) => setFloor(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border-subtle bg-canvas px-3 text-sm font-medium text-text-100"
            >
              {FLOORS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-text-300">Qator (blok)</label>
            <select
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              className="flex h-11 w-full rounded-xl border border-border-subtle bg-canvas px-3 text-sm font-medium text-text-100"
            >
              {BLOCKS.map((item) => (
                <option key={item} value={item}>
                  {item}-blok
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Rasta raqami"
            value={stall}
            onChange={(e) => setStall(e.target.value)}
            placeholder="Masalan: 11"
            inputMode="numeric"
          />
          <Input
            label="Qanday topiladi?"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Eskalator yonidagi 2-rasta"
          />
        </div>
      </CrmSection>

      <CrmSection
        title="Yandex xaritada joylashuv"
        description="Haqiqiy bozor joyi — pinni do'koningiz ustiga qo'ying"
        icon={MapPin}
      >
        <MerchantShopYandexMap
          marketSlug={marketSlug}
          shopName={shopName}
          position={gps ? { lat: gps.latitude, lng: gps.longitude } : null}
          onPositionChange={(lat, lng) => void handleMapMove(lat, lng)}
        />
        {gps ? (
          <p className="mt-3 text-xs text-text-400">
            GPS: {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
            {gps.accuracy != null ? ` · ±${Math.round(gps.accuracy)} m` : ""}
            {insideMarket === false ? (
              <span className="ml-2 font-semibold text-red">Bozor tashqarisi</span>
            ) : (
              <span className="ml-2 font-semibold text-emerald-600">Bozor ichida</span>
            )}
          </p>
        ) : (
          <p className="mt-3 text-xs text-amber-800">
            «Hozirgi joyim» tugmasini bosing yoki xaritada pin qo&apos;ying
          </p>
        )}
      </CrmSection>

      <div className="flex justify-end">
        <button type="button" className="crm-btn-primary" onClick={() => void finalizeLocation()}>
          <MapPin className="mr-2 inline h-4 w-4" />
          Joylashuvni saqlash
        </button>
      </div>
    </div>
  );
}
