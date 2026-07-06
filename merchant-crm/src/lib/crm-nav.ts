import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Film,
  ImageIcon,
  LayoutDashboard,
  MapPin,
  Megaphone,
  MessageCircle,
  Package,
  Rocket,
  ShoppingBag,
  Star,
  UserRound,
  Wallet,
} from "lucide-react";

export type CrmNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
};

/** Asosiy menyu — 6 ta tushunarli bo'lim */
export const CRM_MAIN_NAV: CrmNavItem[] = [
  {
    href: "/dashboard",
    label: "Bosh sahifa",
    description: "Bugungi vazifalar va tezkor harakatlar",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/sales",
    label: "Savdo",
    description: "Buyurtmalar va murojaatlar",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/chat",
    label: "Chat",
    description: "Mijozlar bilan yozishma",
    icon: MessageCircle,
  },
  {
    href: "/dashboard/products",
    label: "Mahsulotlar",
    description: "Katalog va yuklash",
    icon: Package,
  },
  {
    href: "/dashboard/content",
    label: "Kontent",
    description: "Reels, Stories, reklama",
    icon: Film,
  },
  {
    href: "/dashboard/shop",
    label: "Do'kon",
    description: "Joylashuv, analitika, reja",
    icon: Rocket,
  },
];

export const CRM_SALES_TABS = [
  { id: "orders", label: "Buyurtmalar", href: "/dashboard/sales?tab=orders", icon: ShoppingBag },
  { id: "leads", label: "Murojaatlar", href: "/dashboard/sales?tab=leads", icon: UserRound },
] as const;

export const CRM_PRODUCT_TABS = [
  { id: "catalog", label: "Katalog", href: "/dashboard/products?tab=catalog", icon: Package },
  { id: "moderation", label: "Botdan kelganlar", href: "/dashboard/products?tab=moderation", icon: Package },
  { id: "reviews", label: "Sharhlar", href: "/dashboard/products?tab=reviews", icon: Star },
] as const;

export const CRM_CONTENT_TABS = [
  { id: "reels", label: "Reels", href: "/dashboard/content?tab=reels", icon: Film },
  { id: "stories", label: "Stories", href: "/dashboard/content?tab=stories", icon: ImageIcon },
  { id: "banners", label: "Bosh sahifa reklamasi", href: "/dashboard/content?tab=banners", icon: Megaphone },
] as const;

export const CRM_SHOP_TABS = [
  {
    id: "profile",
    label: "Profil",
    href: "/dashboard/shop?tab=profile",
    icon: UserRound,
    hint: "Nom, telefon, logo va tavsif — mijoz saytida brend",
  },
  {
    id: "share",
    label: "Ulashish",
    href: "/dashboard/shop?tab=share",
    icon: Rocket,
    hint: "QR, havola va mijozga tayyor xabar",
  },
  {
    id: "map",
    label: "Joylashuv",
    href: "/dashboard/shop?tab=map",
    icon: MapPin,
    hint: "Rasta xaritasi va yo'ldagi mijozlar",
  },
  {
    id: "analytics",
    label: "Statistika",
    href: "/dashboard/shop?tab=analytics",
    icon: BarChart3,
    hint: "Ko'rishlar, buyurtmalar, eng mashhur mahsulotlar",
  },
  {
    id: "ads",
    label: "Reklama",
    href: "/dashboard/shop?tab=ads",
    icon: Megaphone,
    hint: "Reklama balansi, boost va banner",
  },
  {
    id: "finance",
    label: "Moliya",
    href: "/dashboard/shop?tab=finance",
    icon: Wallet,
    hint: "Savdo puli, yechish va qarz",
  },
] as const;

export const CRM_BILLING_TABS = [
  {
    id: "ads",
    label: "Reklama",
    href: "/dashboard/billing?tab=ads",
    icon: Megaphone,
    hint: "Boost va bosh sahifa banneri — alohida reklama balansi",
  },
  {
    id: "finance",
    label: "Moliya",
    href: "/dashboard/billing?tab=finance",
    icon: Wallet,
    hint: "Savdo daromadi, kartaga yechish, platforma qarzi",
  },
] as const;

/** Eski URL → yangi hub */
export const CRM_LEGACY_REDIRECTS: Record<string, string> = {
  "/dashboard/orders": "/dashboard/sales?tab=orders",
  "/dashboard/leads": "/dashboard/sales?tab=leads",
  "/dashboard/reels": "/dashboard/content?tab=reels",
  "/dashboard/stories": "/dashboard/content?tab=stories",
  "/dashboard/banners": "/dashboard/content?tab=banners",
  "/dashboard/growth": "/dashboard/shop?tab=share",
  "/dashboard/map": "/dashboard/shop?tab=map",
  "/dashboard/analytics": "/dashboard/shop?tab=analytics",
  "/dashboard/trust": "/dashboard/shop?tab=share",
  "/dashboard/shop?tab=billing": "/dashboard/billing?tab=ads",
  "/dashboard/moderation": "/dashboard/products?tab=moderation",
};
