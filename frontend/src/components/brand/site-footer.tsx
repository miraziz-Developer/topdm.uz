import Link from "next/link";
import { TopdimLogo } from "@/components/brand/topdim-logo";
import { BRAND } from "@/components/brand/brand-tokens";

const LINKS = [
  { label: "Qidiruv", href: "/search" },
  { label: "Xarita", href: "/map" },
  { label: "AI Stilist", href: "/stylist" },
  { label: "Buyurtmalar", href: "/orders" },
  { label: "Profil", href: "/profile" },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border-subtle bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <TopdimLogo variant="full" size="sm" href="/" showTagline />
            <p className="max-w-xs text-xs leading-relaxed text-text-400">
              O'zbekistonning AI marketplace — Ippodrom va Abu Saxiy bozorlaridagi 50,000+ tovar bir joyda.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-400">Sahifalar</p>
            <nav className="flex flex-col gap-1.5">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-ink-700 transition hover:text-electric-500"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-text-400">Ma'lumot</p>
            <p className="text-xs leading-relaxed text-text-400">
              Topdim.UZ — Toshkent, O'zbekiston
            </p>
            <p className="text-xs text-text-400">
              © {new Date().getFullYear()} {BRAND.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
