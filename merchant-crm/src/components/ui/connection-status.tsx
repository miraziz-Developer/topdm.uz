"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type ChatConnectionState = "idle" | "connecting" | "online" | "reconnecting" | "offline";

type ConnectionStatusProps = {
  state: ChatConnectionState;
  className?: string;
};

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  if (state === "online") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-700",
          className,
        )}
      >
        <Wifi className="h-3.5 w-3.5" />
        Jonli
      </span>
    );
  }
  if (state === "connecting") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-electric-500/12 px-2.5 py-1 text-xs font-semibold text-electric-600",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Ulanmoqda…
      </span>
    );
  }
  if (state === "reconnecting") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-800",
          className,
        )}
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Qayta ulanmoqda…
      </span>
    );
  }
  if (state === "idle") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-text-400 ring-1 ring-border-subtle",
          className,
        )}
      >
        Mijoz kutilmoqda
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-red/10 px-2.5 py-1 text-xs font-semibold text-red",
        className,
      )}
    >
      <WifiOff className="h-3.5 w-3.5" />
      Uzilgan
    </span>
  );
}
