import { Home, Search } from "lucide-react";
import Link from "next/link";

import { BrandEmptyState } from "@/components/brand/brand-empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas bg-hero-glow px-4 py-16">
      <div className="w-full max-w-lg">
        <p className="mb-4 text-center text-7xl font-black tracking-tighter text-electric-500/90">404</p>
        <BrandEmptyState
          title="Sahifa topilmadi"
          description="Havola eskirgan yoki noto'g'ri bo'lishi mumkin. Bosh sahifadan qidiruvni davom ettiring."
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/">
              <Button leftIcon={<Home className="h-4 w-4" />}>Bosh sahifa</Button>
            </Link>
            <Link href="/search">
              <Button variant="secondary" leftIcon={<Search className="h-4 w-4" />}>
                Qidiruv
              </Button>
            </Link>
          </div>
        </BrandEmptyState>
      </div>
    </main>
  );
}
