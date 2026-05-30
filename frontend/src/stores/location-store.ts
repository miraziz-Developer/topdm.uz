"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { isInsideIppodromGpsAcceptZone } from "@/lib/geo/market-geo";

type LocationState = {
  currentBlock: string | null;
  navNodeId: string;
  userLat: number | null;
  userLng: number | null;
  userAccuracyM: number | null;
  /** When true, routes start from device GPS (after "Men shu yerda"). */
  useGpsForRoute: boolean;
  setCurrentBlock: (block: string | null) => void;
  setUserGps: (lat: number, lng: number, accuracyM?: number) => void;
  /** Update blue dot only (e.g. watchPosition) — does not change route mode. */
  patchUserGps: (lat: number, lng: number, accuracyM?: number) => void;
  setUseGpsForRoute: (enabled: boolean) => void;
  clearUserGps: () => void;
};

function blockToNavNode(block: string | null): string {
  const letter = block?.replace(/-blok/i, "").trim().charAt(0).toUpperCase();
  return letter ? `entrance-${letter}` : "entrance-A";
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      currentBlock: null,
      navNodeId: "entrance-A",
      userLat: null,
      userLng: null,
      userAccuracyM: null,
      useGpsForRoute: false,
      setCurrentBlock: (block) =>
        set({
          currentBlock: block,
          navNodeId: blockToNavNode(block),
        }),
      setUserGps: (lat, lng, accuracyM) =>
        set({
          userLat: lat,
          userLng: lng,
          userAccuracyM: accuracyM ?? null,
        }),
      patchUserGps: (lat, lng, accuracyM) =>
        set({
          userLat: lat,
          userLng: lng,
          userAccuracyM: accuracyM ?? null,
        }),
      setUseGpsForRoute: (enabled) => set({ useGpsForRoute: enabled }),
      clearUserGps: () =>
        set({
          userLat: null,
          userLng: null,
          userAccuracyM: null,
          useGpsForRoute: false,
        }),
    }),
    {
      name: "bozor-location",
      partialize: (state) => ({
        currentBlock: state.currentBlock,
        navNodeId: state.navNodeId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (state.currentBlock) {
          state.navNodeId = blockToNavNode(state.currentBlock);
        }
        state.userLat = null;
        state.userLng = null;
        state.userAccuracyM = null;
        state.useGpsForRoute = false;
      },
    },
  ),
);

/** Drop invalid GPS fixes (legacy coords or outside bazaar). */
export function sanitizeUserGps(lat: number, lng: number): boolean {
  return isInsideIppodromGpsAcceptZone(lat, lng);
}
