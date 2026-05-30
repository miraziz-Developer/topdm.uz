"use client";

import { useEffect, useState } from "react";

import { useToast } from "@/components/ui/toast";

const LIVE_NAMES = ["Dilnoza", "Jasur", "Madina", "Azizbek", "Nilufar"];

export function useLivePurchaseToasts(enabled: boolean) {
  const { push } = useToast();

  useEffect(() => {
    if (!enabled) return;
    const buyer = LIVE_NAMES[Math.floor(Math.random() * LIVE_NAMES.length)];
    const timer = window.setTimeout(() => {
      push(`${buyer} guruh xaridini yakunladi`, "success");
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [enabled, push]);
}

export function GroupBuyCountdown({ seconds = 300 }: { seconds?: number }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    const timer = window.setInterval(() => setLeft((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const minutes = String(Math.floor(left / 60)).padStart(2, "0");
  const secs = String(left % 60).padStart(2, "0");

  return (
    <p className="text-sm font-medium text-neon-500">
      Yana 1 kishi kerak, vaqt tugashiga {minutes}:{secs}
    </p>
  );
}
