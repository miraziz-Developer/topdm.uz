import Link from "next/link";

export function PoweredByBozorliii({ className = "" }: { className?: string }) {
  return (
    <footer
      className={`border-t border-black/[0.06] bg-white/60 px-4 py-6 text-center ${className}`}
    >
      <p className="text-[11px] leading-relaxed text-ink-500">
        <Link
          href="https://t.me/Bozorliiicrm_bot?start=register"
          className="font-medium text-electric-600 transition-colors hover:text-electric-700"
        >
          Powered by Bozorliii
        </Link>
        <span className="mx-1 text-ink-300">·</span>
        O&apos;z onlayn do&apos;koningizni 5 daqiqada tekin oching
      </p>
    </footer>
  );
}
