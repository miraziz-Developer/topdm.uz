"use client";

import { create } from "zustand";

type FlyPayload = {
  image: string;
  x: number;
  y: number;
};

type FlyState = {
  payload: FlyPayload | null;
  launch: (payload: FlyPayload) => void;
  clear: () => void;
};

export const useFlyToCartStore = create<FlyState>((set) => ({
  payload: null,
  launch: (payload) => set({ payload }),
  clear: () => set({ payload: null }),
}));
