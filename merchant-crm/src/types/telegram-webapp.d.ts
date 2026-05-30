interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  sendData: (data: string) => void;
  initDataUnsafe?: { user?: { id?: number } };
}

interface Window {
  Telegram?: { WebApp?: TelegramWebApp };
}
