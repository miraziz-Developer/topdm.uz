import type { CapacitorConfig } from "@capacitor/cli";

const webUrl =
  process.env.BOZORLIII_WEB_URL?.trim() ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3002" : "https://bozorliii.online");

const config: CapacitorConfig = {
  appId: "uz.bozorliii.app",
  appName: "Bozorliii",
  webDir: "www",
  server: {
    url: webUrl,
    cleartext: webUrl.startsWith("http://"),
    allowNavigation: ["localhost", "127.0.0.1", "bozorliii.online", "*.bozorliii.online"],
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#0066ff",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
    },
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
