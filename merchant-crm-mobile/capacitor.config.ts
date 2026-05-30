import type { CapacitorConfig } from "@capacitor/cli";

const crmUrl =
  process.env.MERCHANT_CRM_URL?.trim() ||
  (process.env.NODE_ENV === "development"
    ? "http://localhost:3003"
    : "https://crm.topdim.uz");

const config: CapacitorConfig = {
  appId: "uz.topdim.merchant",
  appName: "Topdim Merchant CRM",
  webDir: "www",
  server: {
    url: crmUrl,
    cleartext: crmUrl.startsWith("http://"),
    allowNavigation: ["localhost", "127.0.0.1", "crm.topdim.uz", "*.topdim.uz", "topdim.uz"],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon_config_sample",
      iconColor: "#0066FF",
    },
  },
};

export default config;
