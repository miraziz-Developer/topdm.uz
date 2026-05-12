declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        colorScheme?: "light" | "dark";
        initDataUnsafe?: { user?: { id?: number; username?: string } };
        ready: () => void;
      };
    };
  }
}

export function initTelegramWebApp() {
  if (typeof window === "undefined" || !window.Telegram?.WebApp) return null;
  const webApp = window.Telegram.WebApp;
  webApp.ready();
  return {
    colorScheme: webApp.colorScheme ?? "light",
    user: webApp.initDataUnsafe?.user ?? null,
  };
}
