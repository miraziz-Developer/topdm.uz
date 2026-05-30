"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

type CarouselConfig = {
  enabled: boolean;
  crossfade: boolean;
  autoplay: boolean;
  interval_ms: number;
};

type Props = {
  initial: CarouselConfig;
  onSave: (patch: Partial<CarouselConfig>) => Promise<void>;
  saving?: boolean;
};

export function CarouselSettingsPanel({ initial, onSave, saving }: Props) {
  const [cfg, setCfg] = useState(initial);

  useEffect(() => {
    setCfg(initial);
  }, [initial]);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-5">
      <h2 className="text-sm font-semibold text-text-100">Bosh sahifa karusel</h2>
      <p className="mt-1 text-xs text-text-400">Mijozlar ko&apos;radigan premium banner aylanishi</p>
      <div className="mt-4 space-y-3">
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Karusel yoqilgan</span>
          <input
            type="checkbox"
            checked={cfg.enabled}
            onChange={(e) => setCfg((c) => ({ ...c, enabled: e.target.checked }))}
            className="h-5 w-5 accent-gold-500"
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Cross-fade animatsiya</span>
          <input
            type="checkbox"
            checked={cfg.crossfade}
            onChange={(e) => setCfg((c) => ({ ...c, crossfade: e.target.checked }))}
            className="h-5 w-5 accent-gold-500"
          />
        </label>
        <label className="flex items-center justify-between gap-4 text-sm">
          <span>Avtomatik aylanish</span>
          <input
            type="checkbox"
            checked={cfg.autoplay}
            onChange={(e) => setCfg((c) => ({ ...c, autoplay: e.target.checked }))}
            className="h-5 w-5 accent-gold-500"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-text-400">Interval (ms)</span>
          <input
            type="number"
            min={2000}
            max={15000}
            step={500}
            value={cfg.interval_ms}
            onChange={(e) => setCfg((c) => ({ ...c, interval_ms: Number(e.target.value) }))}
            className="w-full rounded-xl border border-border-subtle bg-input px-3 py-2"
          />
        </label>
      </div>
      <Button className="mt-4" size="sm" isLoading={saving} onClick={() => void onSave(cfg)}>
        Saqlash va yangilash
      </Button>
    </div>
  );
}
