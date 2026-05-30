"use client";

type UserLocationMarkerProps = {
  accuracyM?: number | null;
};

/** Device GPS position — matches Google Maps-style blue dot with accuracy ring. */
export function UserLocationMarker({ accuracyM }: UserLocationMarkerProps) {
  const ringSize =
    accuracyM != null && accuracyM > 0
      ? Math.min(120, Math.max(28, accuracyM * 1.4))
      : 36;

  return (
    <div className="user-location-marker relative flex items-center justify-center" aria-hidden>
      <span
        className="absolute rounded-full border-2 border-blue-500/25 bg-blue-500/10"
        style={{ width: ringSize, height: ringSize }}
      />
      <span className="relative z-10 h-4 w-4 rounded-full border-[2.5px] border-white bg-blue-600 shadow-md" />
    </div>
  );
}
