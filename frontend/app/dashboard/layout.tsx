import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { merchantCrmUrl } from "@/lib/runtime-flags";

/**
 * Merchant dashboards live on crm.bozorliii.uz — block accidental customer-app access in production.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    redirect(merchantCrmUrl());
  }
  return children;
}
