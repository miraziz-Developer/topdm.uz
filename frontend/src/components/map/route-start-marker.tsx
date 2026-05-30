"use client";

/** Map start point (A) for navigation — distinct from destination shop pin. */
export function RouteStartMarker() {
  return (
    <div
      className="relative flex h-7 w-7 items-center justify-center"
      aria-hidden
    >
      <span className="absolute inset-0 rounded-full bg-emerald-400/25 ring-4 ring-emerald-500/15" />
      <span className="relative flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md">
        <span className="text-[9px] font-black text-white">A</span>
      </span>
    </div>
  );
}
