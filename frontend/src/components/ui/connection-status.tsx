"use client";

import { Loader2, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

type ConnectionStatusProps = {
  connected: boolean;
  reconnecting: boolean;
  className?: string;
};

export function ConnectionStatus({ connected, reconnecting, className }: ConnectionStatusProps) {
  if (connected) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-green/10 px-2 py-0.5 text-xs font-medium text-green",
          className,
        )}
      >
        <Wifi className="h-3 w-3" />
        Online
      </span>
    );
  }
  if (reconnecting) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700",
          className,
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        Qayta ulanmoqda…
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-red/10 px-2 py-0.5 text-xs font-medium text-red",
        className,
      )}
    >
      <WifiOff className="h-3 w-3" />
      Uzilgan
    </span>
  );
}
