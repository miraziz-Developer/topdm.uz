"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type LoyaltyState = {
  coins: number;
  earn: (amount: number) => void;
  spend: (amount: number) => boolean;
};

export const useLoyaltyStore = create<LoyaltyState>()(
  persist(
    (set, get) => ({
      coins: 0,
      earn: (amount) => set({ coins: get().coins + Math.max(0, amount) }),
      spend: (amount) => {
        if (get().coins < amount) return false;
        set({ coins: get().coins - amount });
        return true;
      },
    }),
    { name: "bozor-coins" },
  ),
);
