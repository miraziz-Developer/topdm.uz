import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getProduct } from "@/lib/api";

type ProductLayoutProps = {
  children: ReactNode;
  params: { id: string };
};

export async function generateMetadata({ params }: ProductLayoutProps): Promise<Metadata> {
  try {
    const product = await getProduct(params.id);
    return {
      title: `${product.name} — Topdim.UZ`,
      description: `${product.name} ${product.shop.name} do'konida. ${product.shop.ipadrom} bozorida AI orqali toping.`,
      openGraph: {
        title: product.name,
        description: `${formatPrice(product.price)} • ${product.shop.ipadrom}`,
        images: product.images?.[0] ? [{ url: product.images[0] }] : undefined,
      },
    };
  } catch {
    return { title: "Tovar — Topdim.UZ" };
  }
}

function formatPrice(value: number) {
  return `${value.toLocaleString("uz-UZ")} so'm`;
}

export default async function ProductLayout({ children, params }: ProductLayoutProps) {
  let jsonLd: Record<string, unknown> | null = null;

  try {
    const product = await getProduct(params.id);
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
          name: product.shop.name,
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
