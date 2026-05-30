"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

type WatchedProduct = {
  id: string;
  name: string;
  price: number;
  image?: string;
  seenAt: string;
};

type WatchlistState = {
  items: Record<string, WatchedProduct>;
  favorites: Record<string, true>;
  recordView: (product: { id: string; name: string; price: number; image?: string }) => void;
  toggleFavorite: (product: { id: string; name: string; price: number; image?: string }) => void;
  isFavorite: (productId: string) => boolean;
  getDrop: (product: { id: string; name: string; price: number }) => { amount: number } | null;
};

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: {},
      favorites: {},
      recordView: (product) => {
        set((state) => ({
          items: {
            ...state.items,
            [product.id]: {
              id: product.id,
              name: product.name,
              price: product.price,
              image: product.image,
              seenAt: new Date().toISOString(),
            },
          },
        }));
      },
      toggleFavorite: (product) => {
        set((state) => {
          const next = { ...state.favorites };
          if (next[product.id]) delete next[product.id];
          else next[product.id] = true;
          return {
            favorites: next,
            items: {
              ...state.items,
              [product.id]: {
                id: product.id,
                name: product.name,
                price: product.price,
                image: product.image,
                seenAt: new Date().toISOString(),
              },
            },
          };
        });
      },
      isFavorite: (productId) => Boolean(get().favorites?.[productId]),
      getDrop: (product) => {
        const items = get().items ?? {};
        const previous = items[product.id];
        if (!previous || product.price >= previous.price) return null;
        return { amount: previous.price - product.price };
      },
    }),
    {
      name: "bozor-watchlist",
      merge: (persisted, current) => {
        const saved = persisted as Partial<Pick<WatchlistState, "items" | "favorites">> | undefined;
        return {
          ...current,
          items: saved?.items && typeof saved.items === "object" ? saved.items : {},
          favorites: saved?.favorites && typeof saved.favorites === "object" ? saved.favorites : {},
        };
      },
    },
  ),
);
