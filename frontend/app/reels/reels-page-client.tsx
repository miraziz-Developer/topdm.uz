"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TopdimLogo } from "@/components/brand/topdim-logo";
import { ReelsFeed } from "@/components/reels/reels-feed";

/** Full-screen reels — header hidden via FloatingHeader route check */
export function ReelsPageClient() {
  const sp = useSearchParams();
  const router = useRouter();

  return (
    /* fills entire viewport — no header since it's hidden for /reels */
    <div className="flex h-dvh flex-col bg-black">
      {/* Minimal overlay — safe-area top */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-50 flex items-center justify-between px-4"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="pointer-events-auto flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
        >
          <ArrowLeft className="h-5 w-5 text-white" />
        </button>
        <TopdimLogo
          variant="wordmark"
          size="xs"
          href={null}
          className="brightness-0 invert opacity-80"
        />
        <span className="text-[13px] font-semibold text-white/70">Reels</span>
      </div>

      {/* Feed — flex-1 fills remaining height */}
      <div className="h-dvh w-full overflow-hidden">
        <ReelsFeed
          shopSlug={sp.get("shop") ?? undefined}
          category={sp.get("category") ?? undefined}
        />
      </div>
    </div>
  );
}
