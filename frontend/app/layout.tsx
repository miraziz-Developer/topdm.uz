import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";

import { DynamicFavicon } from "@/components/providers/dynamic-favicon";
import { PriceDropListener } from "@/components/providers/price-drop-listener";
import { FlyToCartLayer } from "@/components/ui/fly-to-cart-layer";
import { PerfectMatchSidebar } from "@/components/ui/perfect-match-sidebar";
import { ApiErrorBridge } from "@/components/providers/api-error-bridge";
import { OrderNotificationsListener } from "@/components/providers/order-notifications-listener";
import { ToastProvider } from "@/components/ui/toast";
import { UserProfileHydrator } from "@/components/providers/user-profile-hydrator";
import { CurrencyProvider } from "@/components/providers/currency-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { PwaRegister } from "@/components/providers/pwa-register";
import { SiteAnalytics } from "@/components/providers/site-analytics";
import { StickyMiniCart } from "@/components/home/sticky-mini-cart";
import { ActionFabDockProvider } from "@/components/ui/action-fab-dock";
import { AIChat } from "@/components/AIChat";
import { MerchantCrmLauncher } from "@/components/merchant/merchant-crm-launcher";
import { TelegramWebAppProvider } from "@/components/providers/telegram-webapp";
import { LayoutGroup } from "framer-motion";

import { QueryProvider } from "@/lib/query-provider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://bozorliii.uz";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Bozorliii.uz — Toshkent bozorlarini AI bilan toping",
  description:
    "Bozorliii.uz — O'zbekistonning AI marketplace. 50,000+ tovar, 2,400+ do'kon. AI bilan 30 soniyada toping!",
  keywords: ["bozorliii", "bozor", "AI", "marketplace", "Toshkent", "ipadrom", "tovar", "qidiruv"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Bozorliii",
    statusBarStyle: "default",
    startupImage: [
      {
        url: "/apple-splash?w=1284&h=2778",
        media: "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/apple-splash?w=1170&h=2532",
        media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
      },
      {
        url: "/apple-splash?w=1290&h=2796",
        media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
      },
    ],
  },
  applicationName: "Bozorliii",
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "Bozorliii",
  },
  icons: {
    icon: [
      { url: "/brand/bozorliii-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/bozorliii-icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
    ],
    shortcut: [{ url: "/brand/bozorliii-icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/brand/bozorliii-icon-180.png", sizes: "180x180", type: "image/png" }],
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0066ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0066ff" },
  ],
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
      <body className="bozor-storefront bozor-sales-canvas mesh-bg overflow-x-clip font-sans antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }} />
        <QueryProvider>
          <LocaleProvider>
            <CurrencyProvider>
              <ToastProvider>
                <ActionFabDockProvider>
                <ApiErrorBridge />
                <OrderNotificationsListener />
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
                <AIChat />
                <LayoutGroup id="bozor-app">{children}</LayoutGroup>
                </ActionFabDockProvider>
              </ToastProvider>
            </CurrencyProvider>
          </LocaleProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
