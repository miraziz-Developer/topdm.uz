/** Telegram Mini App helpers (merchant bot → CRM). */

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
  return getTelegramWebApp()?.initData?.trim() ?? "";
}
