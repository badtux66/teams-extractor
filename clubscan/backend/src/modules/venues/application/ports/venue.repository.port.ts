import { Prisma, Venue, VenueScore } from '@prisma/client';
import { Paginated } from '@/platform/pagination/cursor';

export const VENUE_REPOSITORY = Symbol('VENUE_REPOSITORY');

export interface VenueListFilter {
  city?: string;
  type?: Venue['type'];
  genre?: string;
  q?: string;
  near?: { lat: number; lng: number };
  radiusKm: number;
  sort: 'score' | 'recent' | 'distance';
  cursor?: string;
  limit?: number;
}

export type VenueWithScore = Venue & { score: VenueScore | null };

export type VenueDetail = Prisma.VenueGetPayload<{
  include: {
    score: true;
    photos: true;
    hours: true;
    genres: { include: { genre: true } };
  };
}>;

/**
 * Repository port — hides Prisma from the application layer (Phase 3 §1).
 * Geo queries are implemented with raw SQL (PostGIS ST_DWithin) in the adapter.
 */
export interface VenueRepositoryPort {
  list(filter: VenueListFilter): Promise<Paginated<VenueWithScore>>;
  findBySlug(slug: string): Promise<VenueDetail | null>;
  findById(id: string): Promise<Venue | null>;
}
