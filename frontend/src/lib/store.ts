"use client";

import { create } from "zustand";

type DashboardState = {
  selectedShopId: string;
  setSelectedShopId: (shopId: string) => void;
};

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedShopId: "",
  setSelectedShopId: (shopId) => set({ selectedShopId: shopId }),
}));
