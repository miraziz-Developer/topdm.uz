/** Yandex Maps JS API 2.1 — script loader (singleton). */

export type YMapsApi = typeof ymaps;

declare global {
  interface Window {
    ymaps?: YMapsApi;
  }
}

let loadPromise: Promise<YMapsApi> | null = null;

/** Skript yuklanmaganida qayta urinish uchun. */
export function resetYandexMapsLoader(): void {
  loadPromise = null;
  if (typeof document !== "undefined") {
    document.querySelectorAll('script[src*="api-maps.yandex.ru"]').forEach((el) => el.remove());
  }
  if (typeof window !== "undefined") {
    (window as Window & { ymaps?: YMapsApi }).ymaps = undefined;
  }
}

/** Yandex Developer kabinetida «HTTP referrer» ro‘yxatiga qo‘shish kerak. */
export function yandexMapsReferrerPatterns(): string[] {
  if (typeof window === "undefined") {
    return ["http://localhost:3002/*", "https://bozorliii.uz/*", "https://www.bozorliii.uz/*"];
  }
  const { protocol, host } = window.location;
  const origin = `${protocol}//${host}`;
  const patterns = new Set<string>([
    `${origin}/*`,
    "http://localhost/*",
    "http://127.0.0.1/*",
    "https://bozorliii.uz/*",
    "https://www.bozorliii.uz/*",
  ]);
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    patterns.add(`http://${host}/*`);
    patterns.add(`http://${host}:*/*`);
  }
  return [...patterns];
}

export function describeYandexMapsLoadFailure(): string {
  const refs = yandexMapsReferrerPatterns().slice(0, 4).join(", ");
  return (
    "Yandex xarita skripti yuklanmadi. Developer kabinetida kalit uchun «HTTP referrer» ga quyidagilarni qo‘shing: " +
    refs
  );
}

export function resolveYandexMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "").trim();
}

export function isYandexMapsApiEnabled(): boolean {
  const key = resolveYandexMapsApiKey();
  return key.length >= 8 && !key.startsWith("your-");
}

/** `.env` da `NEXT_PUBLIC_MAP_PROVIDER=yandex-maps-api` bo‘lsa — Yandex rejimi. */
export function isYandexMapsPreferred(): boolean {
  const provider = (process.env.NEXT_PUBLIC_MAP_PROVIDER ?? "yandex-maps-api")
    .trim()
    .toLowerCase();
  return provider === "yandex-maps-api" || provider === "yandex";
}

/** JS xarita yoki server Router API — haqiqiy Yandex yo‘li. */
export function isYandexNavigationActive(): boolean {
  return isYandexMapsApiEnabled() || isYandexRouterConfigured();
}

function isYandexRouterConfigured(): boolean {
  const key = (
    process.env.YANDEX_ROUTER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY?.trim() ||
    ""
  );
  return key.length >= 8 && !key.startsWith("your-");
}

export function loadYandexMaps(apiKey: string): Promise<YMapsApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Yandex Maps only loads in the browser"));
  }

  if (window.ymaps) {
    return new Promise((resolve) => {
      window.ymaps!.ready(() => resolve(window.ymaps!));
    });
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=uz_UZ&load=package.full&coordorder=latlong`;
      script.async = true;
      script.onload = () => {
        if (!window.ymaps) {
          reject(new Error("Yandex Maps failed to initialize"));
          return;
        }
        window.ymaps.ready(() => resolve(window.ymaps));
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error(describeYandexMapsLoadFailure()));
      };
      document.head.appendChild(script);
    });
  }

  return loadPromise;
}
