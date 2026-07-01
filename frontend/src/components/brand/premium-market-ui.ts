/**
 * Figma Marketplace shablonlari (MetaMart, Fashion Marketplace, INWOOD) —
 * Bozorliii premium storefront tokenlari.
 */
import { SALES } from "@/components/brand/sales-ui";

export const MARKET = {
  /** Asosiy sahifa foni — issiq editorial gradient */
  pageBg: "market-page-bg",
  /** Kontent konteyner */
  container: "market-container",
  /** Standart kartochka (product, checkout, profile) */
  card: "market-card",
  /** Checkout / bron bo'limi */
  checkoutCard: "market-checkout-card",
  /** Sticky buyurtma xulosasi */
  summaryCard: "market-summary-card",
  /** Sahifa sarlavhasi bloki */
  pageHero: "market-page-hero",
  /** Ichki bo'lim sarlavhasi */
  sectionTitle: "market-section-title",
  /** Trust strip (xavfsizlik, tez bron) */
  trustStrip: "market-trust-strip",
  /** Checkout stepper wrapper */
  stepper: "market-stepper",
  /** Bron muvaffaqiyat modali */
  bronSuccess: "market-bron-success",
  /** Mahsulot sahifasi */
  productFrame: "market-product-frame",
  /** Do'kon vitrinasi */
  shopShell: "market-shop-shell",
  /** Auth kartasi */
  authCard: "market-auth-card",
  ...SALES,
} as const;

export type CheckoutStepId = "cart" | "details" | "confirm";

export const CHECKOUT_STEPS: { id: CheckoutStepId; label: string; short: string }[] = [
  { id: "cart", label: "Savatcha", short: "1" },
  { id: "details", label: "Ma'lumotlar", short: "2" },
  { id: "confirm", label: "Bron", short: "3" },
];
