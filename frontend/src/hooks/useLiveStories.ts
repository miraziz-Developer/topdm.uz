"use client";

import { useQuery } from "@tanstack/react-query";

import { getLiveStories } from "@/lib/api";

export function useLiveStories() {
  return useQuery({
    queryKey: ["live-stories"],
    queryFn: () => getLiveStories(),
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
