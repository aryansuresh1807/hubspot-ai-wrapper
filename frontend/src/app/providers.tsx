'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

/** Keep cached data so it persists when navigating between pages or tabbing away. */
const CACHE_STALE_MS = 5 * 60 * 1000; // 5 min – data stays "fresh", no refetch when returning
const CACHE_GC_MS = 30 * 60 * 1000; // 30 min – keep unused cache for back-navigation

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: CACHE_STALE_MS,
            gcTime: CACHE_GC_MS,
            refetchOnWindowFocus: false, // avoid refetch when tabbing back; cache is shown
            refetchOnReconnect: true,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
