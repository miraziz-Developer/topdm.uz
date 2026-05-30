"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

import { ApiError } from "@/lib/http-client";

function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= 3) return false;
  if (error instanceof ApiError) {
    if (error.status === 0) return true;
    if (error.status >= 502) return true;
  }
  return failureCount < 1;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: shouldRetryQuery,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
            staleTime: 60_000,
            refetchOnWindowFocus: false,
            throwOnError: false,
          },
          mutations: {
            throwOnError: false,
          },
        },
      }),
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
