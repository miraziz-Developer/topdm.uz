/** Yandex pin layout DOM click → React handler (global, chunk-safe). */
let handler: ((shopId: string) => void) | null = null;

export function setYandexShopPinClickHandler(fn: ((shopId: string) => void) | null) {
  handler = fn;
}

export function dispatchYandexShopPinClick(shopId: string) {
  if (!shopId || !handler) return;
  handler(shopId);
}
