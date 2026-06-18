import type { Metadata } from "next";
import { DM_Mono, Outfit } from "next/font/google";
import Script from "next/script";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "Bozorliii.uz CRM — Do'kon boshqaruvi",
  description: "Bozorliii.uz merchant paneli — buyurtmalar, mahsulotlar, QR ulashish",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/bozorliii-icon.svg", type: "image/svg+xml" }],
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
      <body className={`${outfit.variable} ${dmMono.variable} crm-mesh-bg font-sans antialiased`}>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
