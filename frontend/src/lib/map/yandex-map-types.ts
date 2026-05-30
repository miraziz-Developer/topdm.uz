/** Yandex Maps 2.1 — xarita qatlamlari (yandex.ru kabi). */

export type YandexMapLayerId = "yandex#map" | "yandex#satellite" | "yandex#hybrid";

export type YandexMapLayerOption = {
  id: YandexMapLayerId;
  label: string;
  shortLabel: string;
  description: string;
};

export const YANDEX_MAP_LAYERS: YandexMapLayerOption[] = [
  {
    id: "yandex#map",
    label: "Sxema",
    shortLabel: "Sxema",
    description: "Rangli ko‘cha xaritasi (Yandex Navigator)",
  },
  {
    id: "yandex#satellite",
    label: "Sun’iy yo‘ldosh",
    shortLabel: "Satellit",
    description: "Haqiqiy surat — binolar aniqroq",
  },
  {
    id: "yandex#hybrid",
    label: "Gibrid",
    shortLabel: "Gibrid",
    description: "Sun’iy yo‘ldosh + ko‘cha nomlari",
  },
];

const STORAGE_KEY = "bozor-yandex-map-layer";

export const DEFAULT_YANDEX_MAP_LAYER: YandexMapLayerId = "yandex#hybrid";

export function readStoredYandexMapLayer(): YandexMapLayerId {
  if (typeof window === "undefined") return DEFAULT_YANDEX_MAP_LAYER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const hit = YANDEX_MAP_LAYERS.find((l) => l.id === raw);
    return hit?.id ?? DEFAULT_YANDEX_MAP_LAYER;
  } catch {
    return DEFAULT_YANDEX_MAP_LAYER;
  }
}

export function storeYandexMapLayer(id: YandexMapLayerId): void {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
