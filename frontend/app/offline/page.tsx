import Image from "next/image";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="relative h-20 w-20 overflow-hidden rounded-2xl shadow-lg ring-4 ring-white">
        <Image src="/pwa-icon/192" alt="" width={80} height={80} unoptimized className="h-full w-full object-cover" />
      </div>
      <h1 className="mt-6 text-2xl font-bold text-ink-900">Internet yo&apos;q</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">
        Bozorliii offline rejimda cheklangan. Ulanish tiklangach qayta urinib ko&apos;ring.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex rounded-2xl bg-electric-500 px-5 py-3 text-sm font-semibold text-white"
      >
        Bosh sahifaga qaytish
      </Link>
    </main>
  );
}
