"use client";

import { Calendar, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

export const PICKUP_SLOTS = [
  { value: "09:00", label: "09:00 – 11:00", hint: "Ertalab" },
  { value: "12:00", label: "11:00 – 14:00", hint: "Tushlik" },
  { value: "15:00", label: "14:00 – 17:00", hint: "Kechki" },
] as const;

export type PickupSlotValue = (typeof PICKUP_SLOTS)[number]["value"];

export function todayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type PickupScheduleProps = {
  pickupDate: string;
  pickupTime: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  dateError?: string;
};

export function PickupSchedule({
  pickupDate,
  pickupTime,
  onDateChange,
  onTimeChange,
  dateError,
}: PickupScheduleProps) {
  const slotsEnabled = Boolean(pickupDate?.trim());

  return (
    <div className="space-y-5 rounded-2xl border border-electric-500/15 bg-gradient-to-br from-electric-500/[0.06] to-white p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-electric-500/12">
          <Calendar size={18} className="text-neutral-600" aria-hidden />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink-900">Olib ketish vaqti</h3>
          <p className="text-[11px] text-ink-500">Avval sanani tanlang, keyin vaqt oralig&apos;i</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="pickup-date" className="block text-[11px] font-bold uppercase tracking-wider text-electric-500">
          Sana
        </label>
        <div className="relative">
          <input
            id="pickup-date"
            name="pickup-date"
            type="date"
            value={pickupDate}
            min={todayIsoDate()}
            required
            onChange={(e) => onDateChange(e.target.value)}
            className={cn(
              "checkout-date-input block w-full min-h-[3rem] appearance-none rounded-xl border-2 bg-white px-4 py-3 pr-11 text-base font-semibold text-ink-900",
              "shadow-sm transition-colors focus:outline-none",
              dateError ? "border-red-500 ring-2 ring-red-500/20" : "border-electric-500/30 hover:border-electric-500/50",
            )}
            style={{ colorScheme: "light" }}
          />
          <Calendar
            className={cn(
              "pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2",
              pickupDate ? "text-electric-500" : "text-neutral-500",
            )}
            aria-hidden
          />
        </div>
        {!pickupDate ? <p className="text-[11px] font-medium text-neutral-600">Sanani tanlang</p> : null}
        {dateError ? <p className="text-[11px] font-semibold text-red-600">{dateError}</p> : null}
      </div>

      <div
        className={cn(
          "space-y-2 transition-opacity duration-200",
          !slotsEnabled && "pointer-events-none opacity-40",
        )}
        aria-disabled={!slotsEnabled}
      >
        <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-electric-500">
          <Clock size={13} className={slotsEnabled ? "text-electric-500" : "text-neutral-500"} aria-hidden />
          Vaqt oralig&apos;i
          {!slotsEnabled ? <span className="font-normal normal-case text-neutral-500">(sana kerak)</span> : null}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {PICKUP_SLOTS.map((slot) => {
            const active = pickupTime === slot.value;
            return (
              <button
                key={slot.value}
                type="button"
                disabled={!slotsEnabled}
                data-active={active ? "true" : "false"}
                onClick={() => slotsEnabled && onTimeChange(slot.value)}
                className={cn(
                  "checkout-slot-btn rounded-xl border-2 px-3 py-3 text-left transition-all duration-200",
                  slotsEnabled && "active:scale-[0.98]",
                  active && slotsEnabled
                    ? "border-electric-500 bg-white ring-2 ring-electric-500/30"
                    : "border-neutral-200 bg-white",
                )}
              >
                <p className={cn("text-xs font-bold", active && slotsEnabled ? "text-electric-500" : "text-ink-700")}>
                  {slot.label}
                </p>
                <p className="mt-0.5 text-[10px] text-neutral-600">{slot.hint}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
