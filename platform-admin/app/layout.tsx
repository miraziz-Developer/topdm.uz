import type { Metadata, Viewport } from "next";

import { AppProviders } from "@/components/app-providers";

import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export const metadata: Metadata = {
  title: "Bozorliii Platform Admin",
  description: "Platforma biznes boshqaruv CRM",
  robots: "noindex, nofollow",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bozorliii Admin",
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
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className="dark">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
