"use client";

import Image from "next/image";
import { resolveMarkerLogoUrl } from "@/lib/map/marker-media";
import { cn } from "@/lib/utils";

type StoreMarkerPinProps = {
  name: string;
  block?: string;
  stall?: string;
  floor?: string | number;
  row?: string | null;
  comment?: string | null;
  logoUrl?: string | null;
  active?: boolean;
  className?: string;
};

export function StoreMarkerPin({
  name,
  block,
  stall,
  floor,
  row,
  comment,
  logoUrl,
  active = false,
  className,
}: StoreMarkerPinProps) {
  const avatarSrc = resolveMarkerLogoUrl(name, logoUrl);

  return (
    <div
      className={cn(
        "prestige-map-marker relative flex flex-col items-center font-sans",
        active && "z-10 scale-110",
        className,
      )}
      aria-label={name}
      onMouseEnter={(e) => e.currentTarget.removeAttribute("title")}
    >
      {active ? (
        <>
          <span className="absolute -inset-3 animate-ping rounded-full bg-blue-600/30" aria-hidden />
          <span className="absolute -inset-5 rounded-full bg-blue-500/15 blur-sm" aria-hidden />
        </>
      ) : (
        <span className="absolute -inset-1.5 rounded-full bg-blue-500/8" aria-hidden />
      )}
      <span
        className={cn(
          "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-blue-600 bg-white shadow-md transition",
          active
            ? "shadow-blue-500/35 ring-2 ring-blue-500/25"
            : "shadow-slate-300/50",
        )}
      >
        <Image
          src={avatarSrc}
          alt=""
          width={44}
          height={44}
          unoptimized
          className="h-full w-full object-cover"
        />
      </span>
      <div
        className={cn(
          "prestige-map-marker__label mt-1 max-w-[112px] rounded-md px-2 py-1 text-[10px] leading-tight shadow-sm",
          active ? "bg-blue-600 text-white" : "bg-white/95 text-slate-900",
        )}
      >
        <p className="truncate font-semibold">{name}</p>
        {stall ? (
          <p className={cn("mt-0.5 font-bold leading-tight", active ? "text-blue-50" : "text-blue-700")}>
            {row ? `${row} • ` : block ? `${block}-blok • ` : ""}№{stall}
            {typeof floor === "string" && floor.includes("qavat") ? ` • ${floor}` : null}
          </p>
        ) : null}
        {comment ? (
          <p
            className={cn(
              "mt-0.5 line-clamp-2 rounded px-1 py-0.5 text-[9px] font-semibold",
              active ? "bg-blue-700/40 text-blue-50" : "bg-amber-100 text-amber-900",
            )}
          >
            {comment}
          </p>
        ) : null}
      </div>
    </div>
  );
}

