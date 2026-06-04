import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiError } from '@/lib/api/errors';

/**
 * Server-state client (Phase 4 §4.1). Offline-tolerant via AsyncStorage
 * persistence; auth errors are not retried (the client handles refresh/logout).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [401, 403, 404, 422].includes(error.status)) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: { retry: 0 },
  },
});

export const queryPersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'cs.query-cache',
});

/** Stable query keys (Phase 4 §4.1). */
export const queryKeys = {
  me: ['me'] as const,
  feed: ['feed'] as const,
  notifications: ['notifications'] as const,
  venues: (params: Record<string, unknown>) => ['venues', params] as const,
  venue: (slug: string) => ['venue', slug] as const,
  venueReviews: (venueId: string, sort: string) => ['venue', venueId, 'reviews', sort] as const,
  events: (params: Record<string, unknown>) => ['events', params] as const,
  user: (username: string) => ['user', username] as const,
};
