import type { Metadata } from "next";
import { DM_Mono, Outfit } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";

import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-dm-mono" });

export const metadata: Metadata = {
  title: "Topdim.UZ CRM — Do'kon boshqaruvi",
  description: "Topdim.UZ merchant paneli — buyurtmalar, mahsulotlar, QR ulashish",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/topdim-icon.svg", type: "image/svg+xml" }],
  },
  applicationName: "Topdim.UZ CRM",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Topdim.UZ CRM",
    description: "Do'kon boshqaruvi",
    siteName: "Topdim.UZ",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <body className={`${outfit.variable} ${dmMono.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
