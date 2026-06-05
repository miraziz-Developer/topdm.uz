import Link from "next/link";
import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";
import { BRAND } from "@/components/brand/brand-tokens";

const LINKS = [
  { label: "Qidiruv", href: "/search" },
  { label: "Xarita", href: "/map" },
  { label: "AI Stilist", href: "/stylist" },
  { label: "Buyurtmalar", href: "/orders" },
  { label: "Profil", href: "/profile" },
];

type SiteFooterProps = {
  dark?: boolean;
};

export function SiteFooter({ dark = false }: SiteFooterProps) {
  return (
    <footer
      className={
        dark
          ? "border-t border-white/10 bg-[#0D0E12] text-white"
          : "border-t border-border-subtle bg-white"
      }
    >
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <BozorliiiLogo variant="full" size="sm" href="/" showTagline />
            <p className={dark ? "max-w-xs text-xs leading-relaxed text-white/45" : "max-w-xs text-xs leading-relaxed text-text-400"}>
              O'zbekistonning AI marketplace — Ippodrom va Abu Saxiy bozorlaridagi 50,000+ tovar bir joyda.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-2">
            <p
              className={
                dark
                  ? "text-[10px] font-bold uppercase tracking-widest text-white/40"
                  : "text-[10px] font-bold uppercase tracking-widest text-text-400"
              }
            >
              Sahifalar
            </p>
            <nav className="flex flex-col gap-1.5">
              {LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    dark
                      ? "text-sm text-white/65 transition hover:text-cyan-300"
                      : "text-sm text-ink-700 transition hover:text-electric-500"
                  }
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Legal */}
          <div className="flex flex-col gap-2">
            <p
              className={
                dark
                  ? "text-[10px] font-bold uppercase tracking-widest text-white/40"
                  : "text-[10px] font-bold uppercase tracking-widest text-text-400"
              }
            >
              Ma&apos;lumot
            </p>
            <p className={dark ? "text-xs leading-relaxed text-white/45" : "text-xs leading-relaxed text-text-400"}>
              Bozorliii.uz — Toshkent, O&apos;zbekiston
            </p>
            <p className={dark ? "text-xs text-white/40" : "text-xs text-text-400"}>
              © {new Date().getFullYear()} {BRAND.name}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
