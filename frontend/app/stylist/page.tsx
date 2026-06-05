import type { Metadata } from "next";

import { StylistStudio } from "@/components/stylist/stylist-studio";

export const metadata: Metadata = {
  title: "Shaxsiy AI Stilist — Bozorliii.uz",
  description:
    "Ippodrom va Abu Saxiy katalogidan AI stylist: look, byudjet, xarita va haqiqiy mahsulotlar.",
};

export default function StylistPage() {
  return <StylistStudio />;
}
