import "./globals.css";
import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit, DM_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import { QueryProvider } from "@/lib/query-provider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bozor AI — Toshkent bozorlarini AI bilan toping",
  description:
    "O'zbekistonning birinchi AI-powered marketplace platformasi. 50,000+ tovar, 2,400+ do'kon. AI bilan 30 soniyada toping!",
  keywords: ["bozor", "AI", "marketplace", "Toshkent", "ipadrom", "tovar", "qidiruv"],
  openGraph: {
    title: "Bozor AI — AI bilan bozor qidiruvi",
    description: "50,000+ tovar orasidan AI bilan toping",
    siteName: "Bozor AI",
    locale: "uz_UZ",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06060A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz" className={`${outfit.variable} ${dmMono.variable}`}>
      <body className="font-sans antialiased">
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
