"use client";

import { Navigation, ScrollText, Settings2, Users } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { CrmSection, CrmTip } from "@/components/crm/crm-section";
import {
  getIncomingVisitors,
  patchMerchantApproachSettings,
  type IncomingVisitor,
} from "@/lib/api";
import Link from "next/link";
import {
  clampApproachRadiusKm,
  DEFAULT_APPROACH_RADIUS_KM,
  MAX_APPROACH_RADIUS_KM,
  MIN_APPROACH_RADIUS_KM,
} from "@/lib/approach-settings";
import { cn } from "@/lib/utils";

const BAND_COLORS: Record<string, string> = {
  "10km+": "bg-slate-100 text-slate-700",
  "5km": "bg-blue-50 text-blue-800",
  "2km": "bg-indigo-50 text-indigo-800",
  "1km": "bg-violet-50 text-violet-800",
  "500m": "bg-amber-50 text-amber-900",
  bozorda: "bg-electric-500/15 text-electric-700",
  yaqin: "bg-emerald-50 text-emerald-800",
};

export function IncomingVisitorsPanel() {
  const [visitors, setVisitors] = useState<IncomingVisitor[]>([]);
  const [reserved, setReserved] = useState<IncomingVisitor[]>([]);
  const [radiusKm, setRadiusKm] = useState(DEFAULT_APPROACH_RADIUS_KM);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const initialLogDone = useRef(false);

  const pushLog = useCallback((message: string) => {
    const time = new Date().toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
    setActivityLog((prev) => [`${time} — ${message}`, ...prev].slice(0, 8));
  }, []);

  const load = useCallback(async () => {
    const incoming = await getIncomingVisitors();
    const km = clampApproachRadiusKm(incoming.settings.alert_radius_km);
    const maxKm = incoming.settings.max_alert_radius_km ?? MAX_APPROACH_RADIUS_KM;
    setVisitors(incoming.visitors);
    setReserved(incoming.reserved_without_location);
    setRadiusKm(km);
    setEnabled(incoming.settings.enabled);
    return { km, maxKm, onRoute: incoming.visitors.length, reserved: incoming.reserved_without_location.length };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async (withLog: boolean) => {
      try {
        const snap = await load();
        if (!cancelled && withLog && snap) {
          pushLog(
            `Yuklandi: ${snap.km} km radius · maksimal ${snap.maxKm} km · yo'lda ${snap.onRoute}, bron ${snap.reserved}`,
          );
        }
      } catch {
        if (!cancelled) toast.error("Yuklab bo'lmadi");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    if (!initialLogDone.current) {
      initialLogDone.current = true;
      void tick(true);
    } else {
      void tick(false);
    }
    const id = window.setInterval(() => void tick(false), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [load, pushLog]);

  const saveSettings = async () => {
    const km = clampApproachRadiusKm(radiusKm);
    setRadiusKm(km);
    setSaving(true);
    try {
      const res = await patchMerchantApproachSettings({ enabled, alert_radius_km: km });
      const maxKm = res.settings.max_alert_radius_km ?? MAX_APPROACH_RADIUS_KM;
      pushLog(`Saqlandi: ${km} km · maksimal ${maxKm} km · ${enabled ? "yoqilgan" : "o'chirilgan"}`);
      toast.success(`Saqlandi — ${km} km (maksimal ${maxKm} km)`);
      await load();
    } catch {
      toast.error("Saqlab bo'lmadi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 border-t border-border-subtle pt-6">
      <CrmTip>
        Bron qilgan mijoz <strong className="font-semibold text-text-100">taxminan qanchalik uzoqda</strong> ekanini ko&apos;rasiz —
        aniq uy manzili emas. Ko&apos;rish masofasi <strong className="font-semibold text-text-100">maksimal 10 km</strong>.
      </CrmTip>

      <div className="crm-surface-card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-electric-500/10 text-electric-600">
            <Navigation className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-text-100">Yo&apos;ldagi mijozlar</p>
            <p className="text-sm text-text-400">
              {enabled
                ? `Xarita ochilgan bronlar · ${radiusKm} km radius`
                : "O'chirilgan — yo'ldagilarni ko'rmaysiz"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 rounded-xl bg-canvas px-4 py-2 ring-1 ring-border-subtle">
            <Users className="h-5 w-5 text-electric-500" />
            <span className="text-2xl font-bold tabular-nums text-text-100">{visitors.length}</span>
            <span className="text-xs text-text-400">yo&apos;lda</span>
          </div>
          {reserved.length > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 ring-1 ring-amber-500/20">
              <span className="text-2xl font-bold tabular-nums text-amber-900">{reserved.length}</span>
              <span className="text-xs text-amber-900">bron (xarita kutilmoqda)</span>
            </div>
          ) : null}
        </div>
      </div>

      <CrmSection
        title="Qancha uzoqdan ko'rinsin?"
        description={`1 km dan ${MAX_APPROACH_RADIUS_KM} km gacha — katta radius ko'proq mijoz, kichik faqat yaqin atrof`}
        icon={Settings2}
      >
        <div className="space-y-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-canvas px-3 py-2.5 text-sm font-medium text-text-100 w-fit">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-border-subtle text-electric-500"
            />
            Yo&apos;ldagi mijozlarni ko&apos;rsatish
          </label>

          <div className={cn("space-y-3", !enabled && "pointer-events-none opacity-50")}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-text-300">Masofa</span>
              <span className="rounded-lg bg-electric-500/10 px-3 py-1 text-sm font-bold tabular-nums text-electric-700">
                {radiusKm} km
              </span>
            </div>
            <input
              type="range"
              min={MIN_APPROACH_RADIUS_KM}
              max={MAX_APPROACH_RADIUS_KM}
              step={1}
              value={radiusKm}
              onChange={(e) => setRadiusKm(clampApproachRadiusKm(Number(e.target.value)))}
              className="h-2 w-full cursor-pointer accent-electric-500"
              aria-label="Ko'rish radiusi kilometrda"
            />
            <div className="flex justify-between text-[11px] text-text-400">
              <span>1 km</span>
              <span>Maksimal {MAX_APPROACH_RADIUS_KM} km</span>
            </div>
          </div>

          <button type="button" className="crm-btn-primary" disabled={saving} onClick={() => void saveSettings()}>
            Saqlash
          </button>

          <div className="rounded-xl border border-border-subtle bg-canvas/80 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-text-300">
              <ScrollText className="h-3.5 w-3.5" />
              Jurnal
            </p>
            {activityLog.length === 0 ? (
              <p className="mt-2 text-xs text-text-400">Saqlang yoki sahifa yangilang — maksimal {MAX_APPROACH_RADIUS_KM} km logda chiqadi</p>
            ) : (
              <ul className="mt-2 space-y-1 font-mono text-[11px] leading-relaxed text-text-400">
                {activityLog.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CrmSection>

      {loading ? (
        <div className="skeleton h-32 rounded-2xl" />
      ) : (
        <>
          {!enabled ? (
            <p className="crm-surface-card py-8 text-center text-sm text-text-400">
              Yo&apos;ldagi mijozlar o&apos;chirilgan. Qayta yoqish uchun yuqoridagi belgini yoqing va saqlang.
            </p>
          ) : null}

          {enabled && visitors.length === 0 ? (
            <p className="crm-surface-card py-8 text-center text-sm text-text-400">
              Hozircha hech kim yo&apos;lda emas. Mijoz xaritani ochganda shu yerda masofa chiqadi.
            </p>
          ) : null}

          {enabled && visitors.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {visitors.map((v) => (
                <article key={v.order_id} className="crm-surface-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-100">{v.product_name || "Buyurtma"}</p>
                      <p className="text-xs text-text-400">{v.customer_label}</p>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-lg px-2 py-1 text-xs font-semibold",
                        BAND_COLORS[v.distance_band ?? ""] ?? "bg-canvas text-text-400",
                      )}
                    >
                      {v.distance_label}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-text-400">
                    {v.arrival_status === "at_shop" ? (
                      <span className="font-medium text-emerald-700">
                        Do&apos;konda
                        {v.dwell_minutes != null ? ` · ${v.dwell_minutes} daq` : ""}
                      </span>
                    ) : v.inside_market ? (
                      "Bozor ichida"
                    ) : (
                      `Taxminan ${v.distance_m} m`
                    )}
                  </p>
                  {v.arrival_status === "at_shop" ? (
                    <Link href="/scan" className="crm-btn-primary mt-3 inline-flex text-xs">
                      QR skaner orqali yakunlash
                    </Link>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}

          {reserved.length > 0 ? (
            <CrmSection
              title="Bronlar — joylashuv kutilmoqda"
              description="Mijoz hali xaritani ochmagan; joylashuvni yuqorida saqlagan bo'lsangiz, ochganda masofa chiqadi"
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {reserved.map((r) => (
                  <article key={r.order_id} className="rounded-xl border border-dashed border-border-subtle bg-canvas/50 p-4">
                    <p className="font-medium text-text-100">{r.product_name}</p>
                    <p className="mt-1 text-xs text-text-400">{r.customer_label}</p>
                    <p className="mt-2 text-xs text-amber-800">{r.note}</p>
                  </article>
                ))}
              </div>
            </CrmSection>
          ) : null}
        </>
      )}
    </div>
  );
}
