declare global {
  interface Window {
    ymaps?: {
      ready: (cb: () => void) => void;
      Map: new (
        parent: HTMLElement,
        state: { center: number[]; zoom: number; controls?: string[] },
        options?: Record<string, unknown>,
      ) => unknown;
      Polygon: new (
        coords: number[][][],
        properties?: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => unknown;
      Placemark: new (
        coords: number[],
        properties?: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => unknown;
    };
  }
}

let loadPromise: Promise<NonNullable<Window["ymaps"]>> | null = null;
let runtimeKeyCache: string | undefined;

export function resolveYandexMapsApiKey(): string {
  return (process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "").trim();
}

export function isYandexMapsApiKeyValid(key: string): boolean {
  return key.length >= 8 && !key.startsWith("your-");
}

export function isYandexMapsApiEnabled(): boolean {
  return isYandexMapsApiKeyValid(resolveYandexMapsApiKey());
}

/** Build vaqtida kalit bo‘lmasa — server .env dan /api/config/maps orqali oladi. */
export async function fetchYandexMapsApiKey(): Promise<string> {
  const builtIn = resolveYandexMapsApiKey();
  if (isYandexMapsApiKeyValid(builtIn)) return builtIn;
  if (typeof window === "undefined") return "";
  if (runtimeKeyCache !== undefined) return runtimeKeyCache;

  try {
    const res = await fetch("/api/config/maps", { cache: "no-store" });
    if (!res.ok) {
      runtimeKeyCache = "";
      return "";
    }
    const data = (await res.json()) as { apiKey?: string };
    runtimeKeyCache = (data.apiKey ?? "").trim();
  } catch {
    runtimeKeyCache = "";
  }
  return runtimeKeyCache;
}

export function loadYandexMaps(apiKey: string): Promise<NonNullable<Window["ymaps"]>> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser only"));
  }
  if (window.ymaps) {
    return new Promise((resolve) => window.ymaps!.ready(() => resolve(window.ymaps!)));
  }
  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(apiKey)}&lang=uz_UZ&load=package.full&coordorder=latlong`;
      script.async = true;
      script.onload = () => {
        if (!window.ymaps) {
          reject(new Error("Yandex xarita yuklanmadi"));
          return;
        }
        window.ymaps.ready(() => resolve(window.ymaps!));
      };
      script.onerror = () => {
        loadPromise = null;
        reject(new Error("Yandex API kaliti yoki referrer noto'g'ri (crm.bozorliii.online qo'shing)"));
      };
      document.head.appendChild(script);
    });
  }
  return loadPromise;
}
