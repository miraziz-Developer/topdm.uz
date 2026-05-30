/** Telegram Mini App (mijoz webapp — topdim.uz). */

export type TelegramWebAppClient = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  openLink: (url: string) => void;
  initData: string;
  initDataUnsafe?: {
    user?: { id?: number; username?: string; first_name?: string };
  };
};

export function getTelegramWebApp(): TelegramWebAppClient | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { Telegram?: { WebApp?: TelegramWebAppClient } }).Telegram?.WebApp;
}

export function isTelegramWebApp(): boolean {
  return Boolean(getTelegramWebApp()?.initData);
}

export function getTelegramInitData(): string {
  return getTelegramWebApp()?.initData?.trim() ?? "";
}

export function initTelegramWebApp(): {
  colorScheme: "light" | "dark";
  user: { id?: number; username?: string } | null;
} | null {
  const webApp = getTelegramWebApp();
  if (!webApp) return null;
  try {
    webApp.ready();
    webApp.expand();
  } catch {
    /* ignore */
  }
  return {
    colorScheme: "light",
    user: webApp.initDataUnsafe?.user ?? null,
  };
}
