import type { Metadata } from "next";
import { Suspense } from "react";
import { ReelsPageClient } from "./reels-page-client";

export const metadata: Metadata = {
  title: "Reels — Bozorliii.uz",
  description: "Do'konlarning qisqa video reellari",
};

export default function ReelsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-dvh w-full items-center justify-center bg-black">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
        </div>
      }
    >
      <ReelsPageClient />
    </Suspense>
  );
}
