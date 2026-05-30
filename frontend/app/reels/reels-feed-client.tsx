"use client";
import { useSearchParams } from "next/navigation";
import { ReelsFeed } from "@/components/reels/reels-feed";
export function ReelsFeedClient() {
  const sp = useSearchParams();
  return (
    <ReelsFeed
      shopSlug={sp.get("shop") ?? undefined}
      category={sp.get("category") ?? undefined}
    />
  );
}
