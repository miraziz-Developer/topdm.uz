import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { DM_Mono, Outfit } from "next/font/google";

import { DynamicFavicon } from "@/components/providers/dynamic-favicon";
import { PriceDropListener } from "@/components/providers/price-drop-listener";
import { FlyToCartLayer } from "@/components/ui/fly-to-cart-layer";
import { PerfectMatchSidebar } from "@/components/ui/perfect-match-sidebar";
import { ApiErrorBridge } from "@/components/providers/api-error-bridge";
import { ToastProvider } from "@/components/ui/toast";
import { UserProfileHydrator } from "@/components/providers/user-profile-hydrator";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { PwaRegister } from "@/components/providers/pwa-register";
import { SiteAnalytics } from "@/components/providers/site-analytics";
import { StickyMiniCart } from "@/components/home/sticky-mini-cart";
import { MerchantCrmLauncher } from "@/components/merchant/merchant-crm-launcher";
import { TelegramWebAppProvider } from "@/components/providers/telegram-webapp";
import { LayoutGroup } from "framer-motion";

import { QueryProvider } from "@/lib/query-provider";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", display: "swap" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono", display: "swap" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bozorliii.uz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bozorliii.uz — Toshkent bozorlarini AI bilan toping",
  description:
    "Bozorliii.uz — O'zbekistonning AI marketplace. 50,000+ tovar, 2,400+ do'kon. AI bilan 30 soniyada toping!",
  keywords: ["bozorliii", "bozor", "AI", "marketplace", "Toshkent", "ipadrom", "tovar", "qidiruv"],
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Bozorliii.uz" },
  applicationName: "Bozorliii.uz",
  other: { "mobile-web-app-capable": "yes" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Bozorliii.uz — AI bilan bozor qidiruvi",
    description: "50,000+ tovar orasidan AI bilan toping",
    siteName: "Bozorliii.uz",
    locale: "uz_UZ",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#f2f4f8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const siteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bozorliii.uz",
    url: "https://bozorliii.uz",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://bozorliii.uz/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="uz">
      <body className={`${outfit.variable} ${dmMono.variable} mesh-bg overflow-x-clip font-sans antialiased`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <QueryProvider>
          <LocaleProvider>
            <CurrencyProvider>
              <ToastProvider>
                <ApiErrorBridge />
                <UserProfileHydrator />
                <DynamicFavicon />
                <PwaRegister />
                <SiteAnalytics />
                <TelegramWebAppProvider />
                <MerchantCrmLauncher variant="dock" />
                <PriceDropListener />
                <FlyToCartLayer />
                <PerfectMatchSidebar />
                <StickyMiniCart />
                <LayoutGroup id="bozor-app">{children}</LayoutGroup>
              </ToastProvider>
            </CurrencyProvider>
          </LocaleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
