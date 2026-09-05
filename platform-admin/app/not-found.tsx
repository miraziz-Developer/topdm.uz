import { LayoutDashboard, LogIn } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-16">
      <section className="admin-card w-full max-w-lg text-center">
        <p className="text-7xl font-black tracking-tighter text-primary/80">404</p>
        <h1 className="mt-4 text-2xl font-bold">Sahifa topilmadi</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Havola eskirgan yoki siz izlagan admin bo‘limi boshqa manzilga ko‘chirilgan bo‘lishi mumkin.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground">
            <LogIn className="h-4 w-4" /> Login
          </Link>
        </div>
      </section>
    </main>
  );
}