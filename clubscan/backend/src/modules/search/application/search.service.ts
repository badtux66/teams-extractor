import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/platform/prisma/prisma.service';

export type SearchType = 'venue' | 'event' | 'user' | 'city' | 'genre' | 'all';

/**
 * Unified search (Phase 1 §8). v1 uses Postgres ILIKE/trigram behind this
 * service so it can later be swapped for OpenSearch/Meilisearch without
 * changing the controller contract (Phase 1 §15 — port abstraction).
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, type: SearchType = 'all', limit = 10) {
    const term = q.trim();
    if (term.length < 2) return { venues: [], events: [], users: [], cities: [], genres: [] };

    const take = Math.min(limit, 25);
    const wantVenues = type === 'all' || type === 'venue';
    const wantEvents = type === 'all' || type === 'event';
    const wantUsers = type === 'all' || type === 'user';
    const wantCities = type === 'all' || type === 'city';
    const wantGenres = type === 'all' || type === 'genre';

    const [venues, events, users, cities, genres] = await Promise.all([
      wantVenues
        ? this.prisma.venue.findMany({
            where: {
              status: 'PUBLISHED',
              deletedAt: null,
              OR: [
                { name: { contains: term, mode: 'insensitive' } },
                { description: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { id: true, slug: true, name: true, city: true, type: true, coverPhotoUrl: true },
            take,
          })
        : [],
      wantEvents
        ? this.prisma.event.findMany({
            where: {
              status: 'PUBLISHED',
              deletedAt: null,
              startsAt: { gte: new Date() },
              title: { contains: term, mode: 'insensitive' },
            },
            select: {
              id: true,
              title: true,
              startsAt: true,
              venue: { select: { name: true, slug: true, city: true } },
            },
            take,
          })
        : [],
      wantUsers
        ? this.prisma.profile.findMany({
            where: {
              deletedAt: null,
              user: { status: { notIn: ['BANNED', 'DELETED', 'SHADOW_BANNED'] } },
              OR: [
                { username: { contains: term, mode: 'insensitive' } },
                { displayName: { contains: term, mode: 'insensitive' } },
              ],
            },
            select: { userId: true, username: true, displayName: true, avatarUrl: true },
            take,
          })
        : [],
      wantCities
        ? this.prisma.venue.findMany({
            where: { status: 'PUBLISHED', deletedAt: null, city: { contains: term, mode: 'insensitive' } },
            distinct: ['city'],
            select: { city: true, country: true },
            take,
          })
        : [],
      wantGenres
        ? this.prisma.genre.findMany({
            where: { name: { contains: term, mode: 'insensitive' } },
            select: { id: true, name: true, slug: true },
            take,
          })
        : [],
    ]);

    return { venues, events, users, cities, genres };
  }
}
