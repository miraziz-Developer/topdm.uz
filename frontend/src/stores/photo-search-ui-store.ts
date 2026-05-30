import { create } from "zustand";

/** Shared photo-search UI state (navbar + /search page). */
type PhotoSearchUiState = {
  isSearching: boolean;
  error: string | null;
  setSearching: (value: boolean) => void;
  setError: (value: string | null) => void;
};

export const usePhotoSearchUiStore = create<PhotoSearchUiState>((set) => ({
  isSearching: false,
  error: null,
  setSearching: (isSearching) => set({ isSearching }),
  setError: (error) => set({ error }),
}));
