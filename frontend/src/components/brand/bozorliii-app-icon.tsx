"use client";

import { useId } from "react";

import { cn } from "@/lib/utils";

const B_BASKET_PATH =
  "M 28 78 L 28 26 C 28 14 38 8 50 10 C 62 12 72 20 72 32 " +
  "C 72 40 62 46 50 48 C 66 50 74 58 74 70 C 74 84 60 90 46 88 C 34 86 28 78";

/** viewBox 0–100: ~9 reads as a bold ~2.5–3px stroke at header icon sizes */
const STROKE_WIDTH = 9;

type BozorliiiAppIconProps = {
  /** Tailwind size classes, e.g. `h-9 w-9`. */
  className?: string;
  interactive?: boolean;
  "aria-label"?: string;
};

export function BozorliiiAppIcon({
  className,
  interactive = true,
  "aria-label": ariaLabel = "Bozorliii",
}: BozorliiiAppIconProps) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");

  return (
    <div
      className={cn(
        "group/appicon relative shrink-0 overflow-hidden rounded-xl",
        "h-9 w-9 border border-slate-200 bg-slate-100",
        "shadow-sm shadow-slate-200/80",
        "transition-[box-shadow,transform] duration-300 ease-out",
        interactive &&
          "motion-safe:group-hover/logo:border-indigo-200 motion-safe:group-hover/logo:shadow-md motion-safe:group-hover/logo:shadow-indigo-200/50",
        className,
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
        role="img"
        aria-label={ariaLabel}
      >
        <defs>
          <linearGradient id={`${id}-stroke`} x1="24" y1="8" x2="78" y2="92" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#1d4ed8" />
            <stop offset="0.42" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#a21caf" />
          </linearGradient>
          <radialGradient
            id={`${id}-node`}
            cx="0"
            cy="0"
            r="1"
            gradientUnits="userSpaceOnUse"
            gradientTransform="translate(50 48) rotate(90) scale(6)"
          >
            <stop stopColor="#ffffff" />
            <stop offset="0.5" stopColor="#2563eb" />
            <stop offset="1" stopColor="#7c3aed" stopOpacity="0.35" />
          </radialGradient>
        </defs>

        <g
          className={cn(
            "origin-[50px_50px] transition-transform duration-300 ease-out",
            interactive &&
              "motion-safe:group-hover/appicon:scale-[1.04] motion-safe:group-hover/logo:scale-[1.04]",
          )}
        >
          <path
            d={B_BASKET_PATH}
            stroke={`url(#${id}-stroke)`}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </g>

        <circle cx="50" cy="48" r="5" fill={`url(#${id}-node)`} />
        <circle cx="50" cy="48" r="2.25" fill="#1e3a8a" />
      </svg>
    </div>
  );
}
