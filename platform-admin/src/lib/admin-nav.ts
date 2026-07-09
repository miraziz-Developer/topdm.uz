import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  MessageSquare,
  Package,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  exact?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  {
    href: "/dashboard",
    label: "Boshqaruv",
    description: "Umumiy ko'rinish va KPI",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    href: "/dashboard/shops",
    label: "Do'konlar",
    description: "Moderatsiya va tasdiqlash",
    icon: Store,
  },
  {
    href: "/dashboard/payouts",
    label: "To'lovlar",
    description: "Merchant payout navbati",
    icon: CreditCard,
  },
  {
    href: "/dashboard/profit",
    label: "Platforma foydasi",
    description: "Komissiya va sweep",
    icon: Wallet,
  },
  {
    href: "/dashboard/analytics",
    label: "Analitika",
    description: "Bozor va trafik",
    icon: BarChart3,
  },
  {
    href: "/dashboard/orders",
    label: "Buyurtmalar",
    description: "Barcha buyurtmalar",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/users",
    label: "Foydalanuvchilar",
    description: "Mijozlar bazasi",
    icon: Users,
  },
  {
    href: "/dashboard/support",
    label: "Murojaatlar",
    description: "CRM support ticketlar",
    icon: MessageSquare,
  },
  {
    href: "/dashboard/premium",
    label: "Premium",
    description: "Reklama va tariflar",
    icon: TrendingUp,
  },
];

export function resolvePageTitle(pathname: string): string {
  const match = ADMIN_NAV.find((item) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`),
  );
  return match?.label ?? "Admin";
}
