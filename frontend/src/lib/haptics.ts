export function triggerHaptic(pattern: number | number[] = 12) {
  if (typeof window === "undefined") return;

  const telegramHaptic = (
    window as Window & {
      Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred: (style: "light" | "medium" | "heavy") => void } } };
    }
  ).Telegram?.WebApp?.HapticFeedback;

  if (telegramHaptic) {
    telegramHaptic.impactOccurred("light");
    return;
  }

  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}
