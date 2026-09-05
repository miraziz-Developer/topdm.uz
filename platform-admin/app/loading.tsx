import { PageLoader } from "@/components/admin-page-loader";

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" aria-label="Sahifa yuklanmoqda" aria-busy="true">
      <PageLoader rows={6} />
    </main>
  );
}