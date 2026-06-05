import { BozorliiiLogo } from "@/components/brand/bozorliii-logo";

type Props = {
  label?: string;
};

export function BrandPageLoader({ label = "Yuklanmoqda…" }: Props) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas bg-hero-glow px-6">
      <BozorliiiLogo variant="full" size="md" href={null} showTagline />
      <div className="h-1 w-32 overflow-hidden rounded-full bg-elevated">
        <div className="h-full w-1/2 animate-[shimmer_1.2s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-electric-500 to-gold-500" />
      </div>
      <p className="text-sm font-medium text-text-400">{label}</p>
    </main>
  );
}
