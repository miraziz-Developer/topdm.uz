import { LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";

import { BrandEmptyState } from "@/components/brand/brand-empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas bg-hero-glow px-4 py-16">
      <div className="w-full max-w-lg">
        <p className="mb-4 text-center text-7xl font-black tracking-tighter text-gold-500/90">404</p>
        <BrandEmptyState
          title="Sahifa topilmadi"
          description="CRM ichida bunday manzil yo'q. Dashboardga qayting yoki qayta kiring."
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/dashboard">
              <Button leftIcon={<LayoutDashboard className="h-4 w-4" />}>Dashboard</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" leftIcon={<LogIn className="h-4 w-4" />}>
                Login
              </Button>
            </Link>
          </div>
        </BrandEmptyState>
      </div>
    </main>
  );
}
