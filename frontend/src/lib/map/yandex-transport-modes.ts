/** Yandex MultiRoute rejimlari — Navigator kabi. */

export type YandexTransportMode = "pedestrian" | "auto" | "masstransit";

export type YandexTransportOption = {
  id: YandexTransportMode;
  label: string;
  shortLabel: string;
  icon: string;
};

export const YANDEX_TRANSPORT_MODES: YandexTransportOption[] = [
  { id: "pedestrian", label: "Piyoda", shortLabel: "Piyoda", icon: "🚶" },
  { id: "auto", label: "Avtomobil", shortLabel: "Avto", icon: "🚗" },
  { id: "masstransit", label: "Jamoat transporti", shortLabel: "Metro/avtobus", icon: "🚌" },
];

export const DEFAULT_YANDEX_TRANSPORT: YandexTransportMode = "pedestrian";

export function transportModeDistanceSuffix(mode: YandexTransportMode): string {
  if (mode === "auto") return "avto yo‘li";
  if (mode === "masstransit") return "jamoat transport";
  return "piyoda yo‘li";
}
