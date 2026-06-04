import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { Paginated, ReviewItem, VenueDetail, VenueListItem } from '@/lib/api/types';
import { queryKeys } from '@/lib/query/queryClient';

export interface VenueFilters {
  city?: string;
  type?: string;
  genre?: string;
  q?: string;
  near?: string;
  sort?: 'score' | 'recent' | 'distance';
}

export function useVenues(filters: VenueFilters = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.venues(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Paginated<VenueListItem>>('/venues', {
        ...filters,
        cursor: pageParam,
        limit: 20,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

export function useVenue(slug: string) {
  return useQuery({
    queryKey: queryKeys.venue(slug),
    queryFn: () => apiClient.get<VenueDetail>(`/venues/${slug}`),
    enabled: !!slug,
  });
}

export function useVenueReviews(venueId: string, sort: 'recent' | 'helpful' = 'recent') {
  return useInfiniteQuery({
    queryKey: queryKeys.venueReviews(venueId, sort),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      apiClient.get<Paginated<ReviewItem>>(`/venues/${venueId}/reviews`, {
        sort,
        cursor: pageParam,
        limit: 20,
      }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: !!venueId,
  });
}
