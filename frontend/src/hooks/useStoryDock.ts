"use client";

import { useQuery } from "@tanstack/react-query";

import { getStoryDock } from "@/lib/api";

export function useStoryDock(limit = 15) {
  return useQuery({
    queryKey: ["story-dock", limit],
    queryFn: () => getStoryDock(limit),
    staleTime: 45_000,
    refetchInterval: 60_000,
    retry: 1,
  });
}
