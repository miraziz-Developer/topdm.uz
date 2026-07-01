import type { Metadata } from "next";
import Script from "next/script";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Bozorliii.uz CRM — Do'kon boshqaruvi",
  description: "Bozorliii.uz merchant paneli — buyurtmalar, mahsulotlar, QR ulashish",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/bozorliii-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/bozorliii-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  applicationName: "Bozorliii.uz CRM",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Bozorliii.uz CRM",
    description: "Do'kon boshqaruvi",
    siteName: "Bozorliii.uz",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <link rel="preconnect" href="https://fonts.bunny.net" />
        <link
          href="https://fonts.bunny.net/css?family=fraunces:500,600,700|outfit:400,500,600,700,800"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
