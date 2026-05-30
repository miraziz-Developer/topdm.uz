"use client";

export function RouteDestinationMarker() {
  return (
    <div className="relative flex h-8 w-8 items-center justify-center" aria-hidden>
      <span className="absolute inset-0 rounded-full bg-electric-500/25 ring-4 ring-electric-500/20" />
      <span className="relative flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-electric-600 shadow-lg">
        <span className="text-[10px] font-black text-white">B</span>
      </span>
    </div>
  );
}
