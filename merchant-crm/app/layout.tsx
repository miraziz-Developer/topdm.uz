import type { Metadata, Viewport } from "next";
import Script from "next/script";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1857d6",
};

export const metadata: Metadata = {
  title: "Bozorliii CRM — Do'kon boshqaruvi",
  description: "Bozorliii merchant paneli — buyurtmalar, mahsulotlar, QR ulashish",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/bozorliii-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/bozorliii-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Bozorliii CRM",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Bozorliii CRM",
    description: "Do'kon boshqaruvi",
    siteName: "Bozorliii",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
