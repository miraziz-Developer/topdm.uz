import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getProduct } from "@/lib/api";

type ProductLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: ProductLayoutProps): Promise<Metadata> {
  try {
    const { id } = await params;
    const product = await getProduct(id);
    const shopName = product.shop?.name ?? "do'kon";
    const market = product.shop?.ipadrom ?? "bozor";
    const ogImage = absoluteMediaUrl(product.images?.[0]);
    return {
      title: `${product.name} — Bozorliii.online`,
      description: `${product.name} ${shopName} do'konida. ${market} bozorida AI orqali toping.`,
      openGraph: {
        title: product.name,
        description: `${formatPrice(product.price)} • ${market}`,
        images: ogImage ? [{ url: ogImage }] : undefined,
      },
    };
  } catch {
    return { title: "Tovar — Bozorliii.online" };
  }
}

function formatPrice(value: number) {
  return `${value.toLocaleString("uz-UZ")} so'm`;
}

/** OG/JSON-LD crawlerlari uchun media yo'lini absolyut URL ga aylantiradi. */
function absoluteMediaUrl(raw?: string | null): string | undefined {
  const value = (raw ?? "").trim();
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://bozorliii.online").replace(/\/$/, "");
  return `${siteUrl}${value.startsWith("/") ? "" : "/"}${value}`;
}

export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  let jsonLd: Record<string, unknown> | null = null;

  try {
    const { id } = await params;
    const product = await getProduct(id);
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      image: product.images,
      offers: {
        "@type": "Offer",
        priceCurrency: "UZS",
        price: product.price,
        availability: product.is_available ? "https://schema.org/InStock" : "https://schema.org/PreOrder",
        seller: {
          "@type": "Organization",
          name: product.shop?.name ?? "Bozorliii.online",
        },
      },
    };
  } catch {
    jsonLd = null;
  }

  return (
    <>
      {jsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
      {children}
    </>
  );
}
