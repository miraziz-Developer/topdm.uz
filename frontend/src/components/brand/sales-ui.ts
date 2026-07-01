/**
 * Premium sotuv paneli — yagona UI tokenlari.
 * Psixologiya: urgency (qizil/sariq), trust (ko'k), deal (to'q sariq), social proof (yashil).
 */
export const SALES = {
  /** Asosiy kartochka — oltin chiziq + premium soyа */
  panel: "sales-panel premium-card-glow",
  /** Ichki bo'lim (buyurtma tracker, to'lov bloki) */
  panelInset: "sales-panel-inset",
  /** Sahifa konteyneri */
  pageStack: "sales-page-stack",
  /** Sotib olish CTA */
  cta: "sales-cta",
  /** Narx — diqqat markazi */
  priceDeal: "price-deal",
  /** Eski narx (anchoring) */
  priceWas: "price-was",
  /** «X sotilgan» qatori */
  socialProof: "social-proof-line",
  /** Sarlavha ustidagi pill */
  eyebrowGold: "eyebrow-pill-gold",
  eyebrowElectric: "eyebrow-pill",
} as const;

export type SalesBadgeVariant = "deal" | "hot" | "trust" | "urgency";

export const salesBadgeClass: Record<SalesBadgeVariant, string> = {
  deal: "badge-deal",
  hot: "badge-hot",
  trust: "badge-trust",
  urgency: "badge-urgency",
};
