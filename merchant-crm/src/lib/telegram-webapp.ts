/** Telegram Mini App helpers (merchant bot → CRM). */

const INIT_DATA_STORAGE_KEY = "bozorliii_tg_webapp_init_data";

function readInitDataFromHash(): string {
  if (typeof window === "undefined") return "";
  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) return "";
  const params = new URLSearchParams(hash);
  return (params.get("tgWebAppData") || "").trim();
}

function cacheInitData(value: string): string {
  const trimmed = value.trim();
  if (trimmed && typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(INIT_DATA_STORAGE_KEY, trimmed);
  }
  return trimmed;
}

export function getTelegramWebApp():
  | {
      ready: () => void;
      expand: () => void;
      close: () => void;
      initData: string;
      initDataUnsafe?: { user?: { id?: number; username?: string } };
    }
  | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Telegram?: { WebApp?: {
      ready: () => void;
      expand: () => void;
      close: () => void;
      initData: string;
      initDataUnsafe?: { user?: { id?: number; username?: string } };
    } } }).Telegram?.WebApp;
}

export function getWebAppInitData(): string {
  if (typeof window === "undefined") return "";

  const fromSdk = getTelegramWebApp()?.initData?.trim() ?? "";
  if (fromSdk) return cacheInitData(fromSdk);

  const fromHash = readInitDataFromHash();
  if (fromHash) return cacheInitData(fromHash);

  if (typeof sessionStorage !== "undefined") {
    const cached = sessionStorage.getItem(INIT_DATA_STORAGE_KEY)?.trim();
    if (cached) return cached;
  }

  return "";
}

/** Telegram SDK / hash ba'zan kechikadi — WebApp ochilguncha kutamiz. */
export async function waitForWebAppInitData(maxMs = 4500): Promise<string> {
  const started = Date.now();
  while (Date.now() - started < maxMs) {
    const data = getWebAppInitData();
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  return getWebAppInitData();
}
