"use client";

export async function notifyNewOrder(title: string, body: string, tag = "merchant-new-order"): Promise<void> {
  if (typeof window === "undefined") return;

  const anyWindow = window as Window & {
    Capacitor?: {
      Plugins?: {
        LocalNotifications?: {
          requestPermissions: () => Promise<{ display: "granted" | "denied" }>;
          schedule: (payload: {
            notifications: Array<{ id: number; title: string; body: string; schedule?: { at: Date } }>;
          }) => Promise<void>;
        };
      };
    };
  };

  const localNotifications = anyWindow.Capacitor?.Plugins?.LocalNotifications;
  if (localNotifications) {
    try {
      const perm = await localNotifications.requestPermissions();
      if (perm.display === "granted") {
        await localNotifications.schedule({
          notifications: [{ id: Date.now(), title, body, schedule: { at: new Date(Date.now() + 500) } }],
        });
        return;
      }
    } catch {
      // Fallback to web notifications.
    }
  }

  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission !== "granted") return;
  new Notification(title, { body, tag });
}
