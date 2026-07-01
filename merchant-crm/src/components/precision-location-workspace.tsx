"use client";

import { Building2, MapPin, Navigation2, Save, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { CrmSection, CrmTip } from "@/components/crm/crm-section";
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
  type MerchantShopProfile,
} from "@/lib/api";
import { captureCurrentPosition } from "@/lib/geolocation";
import { marketDisplayName } from "@/lib/map/market-geo";
import { cn } from "@/lib/utils";

type PrecisionLocationWorkspaceProps = {
  marketSlug?: string;
};

const FLOORS = [
  { value: "1-qavat", label: "1-qavat" },
  { value: "2-qavat", label: "2-qavat" },
];

const BLOCKS = ["A", "B", "C", "D"];

function parseBlockLetter(shop: MerchantShopProfile): string {
  const fromId = (shop.block_id ?? "").trim().toUpperCase();
  if (BLOCKS.includes(fromId)) return fromId;
  const sector = (shop.block_sector ?? shop.section ?? "").toUpperCase();
  const m = sector.match(/\b([A-D])\s*-?\s*BLOK\b/) ?? sector.match(/\b([A-D])\b/);
  return m && BLOCKS.includes(m[1]) ? m[1] : "A";
}

function parseStallNumber(shop: MerchantShopProfile): string {
  const stall = (shop.stall_number ?? "").trim();
  if (stall && stall !== "—") return stall;
  const section = shop.section ?? "";
  const m = section.match(/rasta\s+(\S+)/i) ?? section.match(/\b(\d{1,4})\b/);
  return m ? m[1] : "";
}

function parseFloorLabel(shop: MerchantShopProfile): string {
  const raw = (shop.floor ?? "").trim();
  if (raw) return raw.includes("qavat") ? raw : `${raw}-qavat`;
  if (shop.floor_level) return `${shop.floor_level}-qavat`;
  return "1-qavat";
}

export function PrecisionLocationWorkspace({ marketSlug = "ippodrom" }: PrecisionLocationWorkspaceProps) {
  const marketName = marketDisplayName(marketSlug);
  const [shopName, setShopName] = useState("Do'kon");
  const [floor, setFloor] = useState("1-qavat");
  const [block, setBlock] = useState("A");
  const [stall, setStall] = useState("");
  const [comment, setComment] = useState("");
  const [gps, setGps] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [loadingGps, setLoadingGps] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        const [me, draftRes] = await Promise.all([getMerchantMe(), getWorkspaceDraft()]);
        const shop = me.shop;
        setShopName(shop.name || "Do'kon");
        setFloor(parseFloorLabel(shop));
        setBlock(parseBlockLetter(shop));
        setStall(parseStallNumber(shop));
        if (shop.location_comment) setComment(shop.location_comment);

        const { draft } = draftRes;
        if (draft.floor) setFloor(String(draft.floor));
        if (draft.block) setBlock(String(draft.block));
        if (draft.stall) setStall(String(draft.stall));
        if (draft.comment) setComment(String(draft.comment));

        if (shop.latitude != null && shop.longitude != null) {
          const geofence = await checkMarketGeofence(marketSlug, shop.latitude, shop.longitude);
          setGps({
            latitude: shop.latitude,
            longitude: shop.longitude,
            accuracy: null,
          });
          setPin(geofence.pin);
        }
      } catch {
        /* optional */
      } finally {
        setHydrated(true);
      }
    };
    void run();
  }, [marketSlug]);

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
    setPin(geofence.pin);
    return geofence;
  };

  const detectCurrentLocation = async () => {
    setLoadingGps(true);
    try {
      const reading = await captureCurrentPosition();
      const geofence = await checkMarketGeofence(marketSlug, reading.latitude, reading.longitude);
      if (!geofence.inside) {
        toast.message("Siz hozir bozor yaqinida emassiz", {
          description: "Xaritada pinni qo'lda qo'ying — ofisdan ham belgilash mumkin.",
        });
        return;
      }
      await applyGps(reading.latitude, reading.longitude, reading.accuracy);
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
      await applyGps(lat, lng, gps?.accuracy ?? null);
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
      toast.error("Xaritada do'kon joyini belgilang (pinni sudrang yoki bosing)");
      return;
    }
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const saveButton = (
    <Button
      onClick={() => void finalizeLocation()}
      isLoading={saving}
      size="sm"
      leftIcon={<Save className="h-4 w-4" />}
    >
      Saqlash
    </Button>
  );

  return (
    <div className="space-y-4 pb-20">
      <CrmTip>
        Bozordan uzoqda bo&apos;lsangiz ham joylashuvni belgilashingiz mumkin — xaritada pinni do&apos;koningiz ustiga qo&apos;ying.
        Maydonlarni to&apos;ldiring va <strong className="font-semibold text-foreground">Saqlash</strong> tugmasini bosing.
        «Hozirgi joyim» faqat bozorda turganingizda qulay.
      </CrmTip>

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => void detectCurrentLocation()}
              isLoading={loadingGps}
              variant="secondary"
              size="sm"
              leftIcon={<Navigation2 className="h-4 w-4" />}
            >
              Hozirgi joyim
            </Button>
            {saveButton}
          </div>
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
        description="Pinni do'koningiz ustiga qo'ying — ofisdan ham, bozordan ham mumkin"
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
            Koordinata: {gps.latitude.toFixed(5)}, {gps.longitude.toFixed(5)}
            {gps.accuracy != null ? ` · ±${Math.round(gps.accuracy)} m` : ""}
          </p>
        ) : (
          <p className="mt-3 text-xs text-amber-800">
            «Hozirgi joyim» tugmasini bosing yoki xaritada pin qo&apos;ying — keyin <strong>Saqlash</strong>
          </p>
        )}
      </CrmSection>

      <div
        className={cn(
          "fixed bottom-0 left-0 right-0 z-30 border-t border-border-subtle bg-surface/95 px-4 py-3 backdrop-blur-md",
          "md:static md:z-auto md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none",
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 md:justify-end">
          <p className="text-xs text-text-400 md:hidden">
            {metadataReady && gps ? "Tayyor — saqlang" : "Maydonlar va xaritani to'ldiring"}
          </p>
          <Button
            onClick={() => void finalizeLocation()}
            isLoading={saving}
            className="min-w-[140px] shrink-0"
            leftIcon={<MapPin className="h-4 w-4" />}
          >
            Joylashuvni saqlash
          </Button>
        </div>
      </div>
    </div>
  );
}
